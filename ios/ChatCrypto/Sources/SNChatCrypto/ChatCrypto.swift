import Foundation
#if canImport(CryptoKit)
import CryptoKit
#else
import Crypto
#endif

public enum ChatCryptoError: Error { case invalidPacket, missingKey, expired, invalidAttachment }

public struct ChatPublicKey: Codable, Equatable, Sendable {
    public let kty: String
    public let crv: String
    public let x: String
    public let y: String

    fileprivate init(_ key: P256.KeyAgreement.PublicKey) {
        let bytes = key.x963Representation
        kty = "EC"; crv = "P-256"
        x = Data(bytes[1..<33]).base64URL
        y = Data(bytes[33..<65]).base64URL
    }

    fileprivate func key() throws -> P256.KeyAgreement.PublicKey {
        guard kty == "EC", crv == "P-256",
              let xBytes = Data(base64URL: x), xBytes.count == 32,
              let yBytes = Data(base64URL: y), yBytes.count == 32 else {
            throw ChatCryptoError.invalidPacket
        }
        return try P256.KeyAgreement.PublicKey(x963Representation: Data([4]) + xBytes + yBytes)
    }
}

public struct ChatDevice: Codable, Equatable, Sendable {
    public let id: String
    public let user_id: String
    public let public_key: ChatPublicKey
    public let label: String
}

/// Private key material stays inside the crypto module. M0.5 uses in-memory test devices;
/// persistent device registration and Keychain storage are part of the later chat integration.
public struct ChatLocalDevice: Sendable {
    public let device: ChatDevice
    fileprivate let privateKey: P256.KeyAgreement.PrivateKey

    public init(userID: String, label: String = "Questo iPhone") {
        let key = P256.KeyAgreement.PrivateKey()
        privateKey = key
        device = ChatDevice(id: UUID().uuidString.lowercased(), user_id: userID,
                            public_key: ChatPublicKey(key.publicKey), label: label)
    }

    #if DEBUG
    // Only for the public, synthetic interoperability vectors. Never import a real user's key here.
    init(testDevice: ChatDevice, testKey: Data) throws {
        let key = try P256.KeyAgreement.PrivateKey(rawRepresentation: testKey)
        guard ChatPublicKey(key.publicKey) == testDevice.public_key else { throw ChatCryptoError.invalidPacket }
        privateKey = key; device = testDevice
    }
    #endif
}

public struct ChatContext: Codable, Equatable, Sendable {
    public var id: String
    public var sender_id: String
    public var recipient_id: String
    public var expires_at: String?
    public var revision: Int?
    public var retention: String

    public init(id: String, senderID: String, recipientID: String, expiresAt: String? = nil,
                revision: Int? = nil, retention: String = "synced") {
        self.id = id; sender_id = senderID; recipient_id = recipientID
        expires_at = expiresAt; self.revision = revision; self.retention = retention
    }

    enum CodingKeys: String, CodingKey { case id, sender_id, recipient_id, expires_at, revision, retention }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id); try c.encode(sender_id, forKey: .sender_id)
        try c.encode(recipient_id, forKey: .recipient_id); try c.encode(expires_at, forKey: .expires_at)
        try c.encodeIfPresent(revision, forKey: .revision); try c.encode(retention, forKey: .retention)
    }

    fileprivate func validate(now: Date) throws {
        guard !id.isEmpty, !sender_id.isEmpty, !recipient_id.isEmpty, sender_id != recipient_id,
              ["synced", "device"].contains(retention), revision.map({ $0 >= 0 }) ?? true else {
            throw ChatCryptoError.invalidPacket
        }
        if let expires_at {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            var expiry = formatter.date(from: expires_at)
            if expiry == nil {
                formatter.formatOptions = [.withInternetDateTime]
                expiry = formatter.date(from: expires_at)
            }
            guard let expiry else { throw ChatCryptoError.invalidPacket }
            guard expiry > now else { throw ChatCryptoError.expired }
        }
    }

    fileprivate func aad() throws -> Data {
        var fields: [Any] = [1, id, sender_id, recipient_id, expires_at as Any? ?? NSNull(), retention]
        if let revision { fields.append(revision) }
        return try JSONSerialization.data(withJSONObject: fields, options: [.withoutEscapingSlashes])
    }
}

public struct ChatMedia: Codable, Equatable, Sendable {
    public let key: String
    public let iv: String
    public let mime: String
}
public struct ChatClearMessage: Codable, Equatable, Sendable {
    public let body: String
    public let media: ChatMedia?
    enum CodingKeys: String, CodingKey { case body, media }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(body, forKey: .body); try c.encode(media, forKey: .media)
    }
}
public struct ChatWrappedKey: Codable, Sendable { public var iv: String; public var ciphertext: String }
public struct ChatPacket: Codable, Sendable {
    public var context: ChatContext
    public var version: Int
    public var sender: ChatDevice
    public var salt: String
    public var iv: String
    public var ciphertext: String
    public var keys: [String: ChatWrappedKey]
}
public struct ChatSealedMessage: Sendable {
    public let sealed: ChatPacket
    public let attachment: Data?
}

public enum ChatCrypto {
    public static func fingerprint(_ device: ChatDevice) throws -> String {
        let key = device.public_key
        _ = try key.key()
        let data = try JSONSerialization.data(withJSONObject: [device.user_id, device.id, key.crv, key.x, key.y],
                                              options: [.withoutEscapingSlashes])
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    public static func seal(sender: ChatLocalDevice, devices: [ChatDevice], context: ChatContext,
                            body: String, attachment: Data? = nil, mime: String? = nil,
                            now: Date = Date()) throws -> ChatSealedMessage {
        try context.validate(now: now)
        guard sender.device.user_id == context.sender_id, body.utf16.count <= 2000,
              devices.contains(sender.device), devices.contains(where: { $0.user_id == context.recipient_id }),
              Set(devices.map(\.id)).count == devices.count,
              devices.allSatisfy({ [context.sender_id, context.recipient_id].contains($0.user_id) }) else {
            throw ChatCryptoError.invalidPacket
        }
        let salt = randomKeyData(), key = SymmetricKey(size: .bits256)
        let aad = try context.aad()
        var media: ChatMedia?
        var encryptedAttachment: Data?
        if let attachment {
            guard let mime, allowedMIMEs.contains(mime) else { throw ChatCryptoError.invalidAttachment }
            let mediaKey = SymmetricKey(size: .bits256)
            let box = try AES.GCM.seal(attachment, using: mediaKey, authenticating: aad)
            encryptedAttachment = box.ciphertext + box.tag
            media = ChatMedia(key: mediaKey.withUnsafeBytes { Data($0).base64EncodedString() },
                              iv: Data(box.nonce).base64EncodedString(), mime: mime)
        }
        let clear = ChatClearMessage(body: body, media: media)
        let box = try AES.GCM.seal(JSONEncoder().encode(clear), using: key, authenticating: aad)
        var keys: [String: ChatWrappedKey] = [:]
        for device in devices {
            let wrapping = try wrappingKey(sender.privateKey, device.public_key, salt, context, device.id)
            let wrapped = try key.withUnsafeBytes { bytes in
                try AES.GCM.seal(Data(bytes), using: wrapping, authenticating: aad)
            }
            keys[device.id] = ChatWrappedKey(iv: Data(wrapped.nonce).base64EncodedString(),
                                           ciphertext: (wrapped.ciphertext + wrapped.tag).base64EncodedString())
        }
        return ChatSealedMessage(sealed: ChatPacket(context: context, version: 1, sender: sender.device,
            salt: salt.base64EncodedString(), iv: Data(box.nonce).base64EncodedString(),
            ciphertext: (box.ciphertext + box.tag).base64EncodedString(), keys: keys), attachment: encryptedAttachment)
    }

    public static func unseal(device: ChatLocalDevice, context: ChatContext, packet: ChatPacket,
                              now: Date = Date()) throws -> ChatClearMessage {
        try context.validate(now: now)
        guard packet.version == 1, packet.context == context,
              packet.sender.user_id == context.sender_id,
              [context.sender_id, context.recipient_id].contains(device.device.user_id) else {
            throw ChatCryptoError.invalidPacket
        }
        guard let entry = packet.keys[device.device.id] else { throw ChatCryptoError.missingKey }
        let salt = try decode(packet.salt, count: 32)
        let wrapping = try wrappingKey(device.privateKey, packet.sender.public_key, salt, context, device.device.id)
        let aad = try context.aad()
        var raw = try open(entry.ciphertext, iv: entry.iv, key: wrapping, aad: aad)
        defer { raw.resetBytes(in: raw.startIndex..<raw.endIndex) }
        guard raw.count == 32 else { throw ChatCryptoError.invalidPacket }
        let clear = try open(packet.ciphertext, iv: packet.iv, key: SymmetricKey(data: raw), aad: aad)
        let value = try JSONDecoder().decode(ChatClearMessage.self, from: clear)
        guard value.body.utf16.count <= 2000 else { throw ChatCryptoError.invalidPacket }
        return value
    }

    public static func openAttachment(context: ChatContext, media: ChatMedia, bytes: Data,
                                      now: Date = Date()) throws -> Data {
        try context.validate(now: now)
        guard allowedMIMEs.contains(media.mime) else { throw ChatCryptoError.invalidAttachment }
        return try open(bytes.base64EncodedString(), iv: media.iv,
                        key: SymmetricKey(data: decode(media.key, count: 32)), aad: context.aad())
    }

    private static let allowedMIMEs: Set<String> = ["image/jpeg", "image/png", "image/webp", "video/mp4",
                                                   "video/webm", "audio/webm", "audio/ogg", "audio/mp4"]
    private static func randomKeyData() -> Data { SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) } }
    private static func decode(_ text: String, count: Int? = nil) throws -> Data {
        guard let bytes = Data(base64Encoded: text), count.map({ $0 == bytes.count }) ?? true else {
            throw ChatCryptoError.invalidPacket
        }
        return bytes
    }
    private static func wrappingKey(_ key: P256.KeyAgreement.PrivateKey, _ other: ChatPublicKey,
                                    _ salt: Data, _ context: ChatContext, _ target: String) throws -> SymmetricKey {
        let shared = try key.sharedSecretFromKeyAgreement(with: other.key())
        return shared.hkdfDerivedSymmetricKey(using: SHA256.self, salt: salt,
            sharedInfo: Data("SN-chat-v1:\(context.id):\(target)".utf8), outputByteCount: 32)
    }
    private static func open(_ ciphertext: String, iv: String, key: SymmetricKey, aad: Data) throws -> Data {
        let bytes = try decode(ciphertext)
        guard bytes.count >= 16 else { throw ChatCryptoError.invalidPacket }
        let nonce = try AES.GCM.Nonce(data: decode(iv, count: 12))
        let box = try AES.GCM.SealedBox(nonce: nonce, ciphertext: bytes.dropLast(16), tag: bytes.suffix(16))
        return try AES.GCM.open(box, using: key, authenticating: aad)
    }
}

private extension Data {
    var base64URL: String { base64EncodedString().replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
    init?(base64URL: String) {
        var text = base64URL.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        text += String(repeating: "=", count: (4 - text.count % 4) % 4)
        self.init(base64Encoded: text)
    }
}
