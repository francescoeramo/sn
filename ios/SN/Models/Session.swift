import Foundation

/// Coppia di token restituita dal server. `expires_at` è in secondi epoch (contratto nativo).
struct TokenPair: Codable, Equatable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Int
    let tokenType: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
        case tokenType = "token_type"
    }

    var expiryDate: Date { Date(timeIntervalSince1970: TimeInterval(expiresAt)) }

    func isExpired(at date: Date = Date(), leeway: TimeInterval = 30) -> Bool {
        expiryDate.timeIntervalSince(date) <= leeway
    }
}

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

/// Risposta di `native/auth/login`: token diretti oppure richiesta di MFA (`mfa_required`).
struct LoginResponse: Decodable, Sendable {
    let mfaRequired: Bool?
    let factorId: String?
    let accessToken: String?
    let refreshToken: String?
    let expiresAt: Int?
    let tokenType: String?

    enum CodingKeys: String, CodingKey {
        case mfaRequired = "mfa_required"
        case factorId = "factor_id"
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
        case tokenType = "token_type"
    }

    func tokenPair() -> TokenPair? {
        guard let accessToken, let refreshToken, let expiresAt else { return nil }
        return TokenPair(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            tokenType: tokenType ?? "bearer"
        )
    }
}

struct RefreshRequest: Encodable {
    let refreshToken: String
    enum CodingKeys: String, CodingKey { case refreshToken = "refresh_token" }
}

struct MfaRequest: Encodable {
    let factorId: String
    let code: String
    enum CodingKeys: String, CodingKey {
        case factorId = "factor_id"
        case code
    }
}

struct EmptyBody: Encodable {}

/// Decodifica parziale (R5): solo ciò che le schermate M0 mostrano davvero.
struct Me: Codable, Equatable, Sendable {
    let id: String
    let username: String
    let displayName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case displayName = "display_name"
    }
}

/// Sottoinsieme di `GET /api/bootstrap`. Il resto dello snapshot è ignorato in M0.
struct Bootstrap: Decodable, Sendable {
    let userId: String
    let me: Me

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case me
    }
}
