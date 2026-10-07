import Foundation
import Security

protocol TokenStore {
    func load() -> TokenPair?
    func save(_ tokens: TokenPair) throws
    func clear()
}

enum TokenStoreError: Error {
    case keychain(OSStatus)
}

/// Conserva la coppia di token nel Keychain, accessibile solo a dispositivo sbloccato.
/// `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`: niente backup né trasferimento su altri device.
struct KeychainTokenStore: TokenStore {
    let service: String
    let account: String

    init(service: String = "it.sn.app.tokens", account: String = "session") {
        self.service = service
        self.account = account
    }

    func load() -> TokenPair? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(TokenPair.self, from: data)
    }

    func save(_ tokens: TokenPair) throws {
        let data: Data
        do {
            data = try JSONEncoder().encode(tokens)
        } catch {
            throw error
        }
        SecItemDelete(baseQuery as CFDictionary)
        var query = baseQuery
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw TokenStoreError.keychain(status) }
    }

    func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
