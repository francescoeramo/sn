#if DEBUG
import Foundation

/// Bounded offline proof. Every private scalar is public fixture data; this never
/// registers a real device, reads an account key, or sends anything to the server.
public enum ChatInteropProbe {
    struct Fixture: Decodable {
        let fixture_id: String
        let phone: ChatDevice
        let phone_test_key: Data
        let web: ChatDevice
        let web_second: ChatDevice
        let fingerprints: [String: String]
        let vectors: [Vector]
    }
    struct Vector: Decodable {
        let context: ChatContext
        let packet: ChatPacket
        let body: String
        let attachment: Data?
        let attachment_clear: Data?
        let reply_context: ChatContext
        let reply_body: String
    }
    struct Reply: Encodable { let sealed: ChatPacket; let attachment: Data? }
    struct Report: Encodable {
        let status = "passed"
        let platform: String
        let generated_at = ISO8601DateFormatter().string(from: Date())
        let fixture_id: String
        let checks: [String]
        let replies: [Reply]
    }
    enum Failure: Error { case check(String) }

    public static func run() throws -> Data {
        let fixture = try JSONDecoder().decode(Fixture.self, from: InteropFixtures.data)
        let phone = try ChatLocalDevice(testDevice: fixture.phone, testKey: fixture.phone_test_key)
        var checks: [String] = [], replies: [Reply] = []
        func require(_ condition: Bool, _ name: String) throws {
            guard condition else { throw Failure.check(name) }; checks.append(name)
        }
        func reject(_ name: String, _ operation: () throws -> Void) throws {
            do { try operation() } catch { checks.append(name); return }
            throw Failure.check(name)
        }
        try require(ChatCrypto.fingerprint(fixture.web) == fixture.fingerprints["web"], "web-fingerprint")
        try require(ChatCrypto.fingerprint(fixture.phone) == fixture.fingerprints["phone"], "phone-fingerprint")
        for (index, vector) in fixture.vectors.enumerated() {
            let clear = try ChatCrypto.unseal(device: phone, context: vector.context, packet: vector.packet)
            try require(clear.body == vector.body, "web-to-swift-\(index)")
            if let bytes = vector.attachment, let expected = vector.attachment_clear, let media = clear.media {
                try require(ChatCrypto.openAttachment(context: vector.context, media: media, bytes: bytes) == expected,
                            "web-attachment-\(index)")
                var changed = bytes; changed[0] ^= 1
                try reject("attachment-tamper-\(index)") {
                    _ = try ChatCrypto.openAttachment(context: vector.context, media: media, bytes: changed)
                }
            } else { try require(clear.media == nil && vector.attachment == nil, "text-only-\(index)") }
            var changed = vector.packet
            var bytes = Data(base64Encoded: changed.ciphertext)!
            bytes[0] ^= 1; changed.ciphertext = bytes.base64EncodedString()
            try reject("ciphertext-tamper-\(index)") {
                _ = try ChatCrypto.unseal(device: phone, context: vector.context, packet: changed)
            }
            for field in ["retention", "revision", "expiry", "recipient", "id"] {
                var context = vector.context
                switch field {
                case "retention": context.retention = context.retention == "synced" ? "device" : "synced"
                case "revision": context.revision = (context.revision ?? 0) + 10
                case "expiry": context.expires_at = "2098-01-01T00:00:00.000Z"
                case "recipient": context.recipient_id = fixture.web_second.id
                default: context.id = UUID().uuidString.lowercased()
                }
                var packet = vector.packet; packet.context = context
                try reject("aad-\(field)-\(index)") {
                    _ = try ChatCrypto.unseal(device: phone, context: context, packet: packet)
                }
            }
            if vector.context.expires_at != nil {
                try reject("expired-\(index)") {
                    _ = try ChatCrypto.unseal(device: phone, context: vector.context, packet: vector.packet,
                        now: Date(timeIntervalSince1970: 4_200_000_000))
                }
            } else {
                try require(ChatCrypto.unseal(device: phone, context: vector.context, packet: vector.packet,
                    now: Date(timeIntervalSince1970: 4_200_000_000)).body == vector.body, "permanent-\(index)")
            }
            let reply = try ChatCrypto.seal(sender: phone, devices: [fixture.phone, fixture.web, fixture.web_second],
                context: vector.reply_context, body: vector.reply_body, attachment: vector.attachment_clear,
                mime: vector.attachment_clear == nil ? nil : "image/webp")
            try require(ChatCrypto.unseal(device: phone, context: vector.reply_context, packet: reply.sealed).body == vector.reply_body,
                        "swift-sender-copy-\(index)")
            replies.append(Reply(sealed: reply.sealed, attachment: reply.attachment))
        }
        let stranger = ChatLocalDevice(userID: "stranger")
        let first = fixture.vectors[0]
        try reject("stranger") { _ = try ChatCrypto.unseal(device: stranger, context: first.context, packet: first.packet) }
        try reject("oversize-unicode") {
            _ = try ChatCrypto.seal(sender: phone, devices: [fixture.phone, fixture.web],
                context: first.reply_context, body: String(repeating: "🔐", count: 1001))
        }
        #if os(iOS)
        let platform = "ios-cryptokit"
        #else
        let platform = "linux-swift-crypto"
        #endif
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(Report(platform: platform, fixture_id: fixture.fixture_id, checks: checks, replies: replies))
    }
}
#endif
