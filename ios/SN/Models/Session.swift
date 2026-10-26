import Foundation

/// Coppia di token restituita dal server. `expires_at` è in secondi epoch (contratto nativo).
struct TokenPair: Codable, Equatable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Int
    let tokenType: String
    // Local Keychain metadata; absent from older records and ordinary server responses.
    var pendingMfaFactorId: String? = nil

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
        case tokenType = "token_type"
        case pendingMfaFactorId = "pending_mfa_factor_id"
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
        if mfaRequired == true, factorId?.isEmpty != false { return nil }
        return TokenPair(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            tokenType: tokenType ?? "bearer",
            pendingMfaFactorId: mfaRequired == true ? factorId : nil
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

/// Sottoinsieme dello snapshot condiviso: sessione e prima finestra del feed.
struct Bootstrap: Decodable, Sendable {
    let userId: String
    let me: Me
    var posts: [FeedPost] = []
    var profiles: [FeedProfile] = []
    var nextCursor: String? = nil
    var nextPostId: String? = nil
    var circlePosts: [CirclePostLink] = []
    var follows: [FeedFollow] = []

    init(userId: String, me: Me, posts: [FeedPost] = [], profiles: [FeedProfile] = [], nextCursor: String? = nil) {
        self.userId = userId
        self.me = me
        self.posts = posts
        self.profiles = profiles
        self.nextCursor = nextCursor
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        userId = try values.decode(String.self, forKey: .userId)
        me = try values.decode(Me.self, forKey: .me)
        posts = try values.decodeIfPresent([FeedPost].self, forKey: .posts) ?? []
        profiles = try values.decodeIfPresent([FeedProfile].self, forKey: .profiles) ?? []
        nextCursor = try values.decodeIfPresent(String.self, forKey: .nextCursor)
        nextPostId = try values.decodeIfPresent(String.self, forKey: .nextPostId)
        circlePosts = try values.decodeIfPresent([CirclePostLink].self, forKey: .circlePosts) ?? []
        follows = try values.decodeIfPresent([FeedFollow].self, forKey: .follows) ?? []
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case me, posts, profiles, nextCursor, nextPostId, circlePosts, follows
    }
}
