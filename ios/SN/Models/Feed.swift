import Foundation

struct FeedProfile: Decodable, Identifiable, Sendable {
    let id: String
    let username: String
    let display_name: String
    let bio: String
}

struct FeedMedia: Decodable, Identifiable, Sendable {
    let id: String
    let media_path: String
    let media_type: String?
    let alt: String
    let position: Int
}

struct FeedPost: Decodable, Identifiable, Sendable {
    let id: String
    let author_id: String
    let body: String
    let kind: String
    let media_path: String?
    let media_type: String?
    let alt: String
    let created_at: String
    let content_warning: String?
    let media: [FeedMedia]?
    let circle_links: [CirclePostLink]?

    var attachments: [FeedMedia] {
        if let media, !media.isEmpty { return media.sorted { $0.position < $1.position } }
        guard let media_path else { return [] }
        return [FeedMedia(id: id, media_path: media_path, media_type: media_type, alt: alt, position: 0)]
    }
    var date: Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: created_at) ?? ISO8601DateFormatter().date(from: created_at)
    }
}

struct FeedPage: Decodable, Sendable {
    let posts: [FeedPost]
    let nextCursor: String?
}

struct UploadedMedia: Decodable, Sendable {
    let path: String
    let mime: String
}

struct NewPost: Encodable, Sendable {
    var body: String
    var media_path: String?
    var alt: String
    let kind = "post"

    enum CodingKeys: String, CodingKey { case body, media_path, alt, kind }
    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(body, forKey: .body)
        try values.encode(media_path, forKey: .media_path) // Required nullable field, including text-only posts.
        try values.encode(alt, forKey: .alt)
        try values.encode(kind, forKey: .kind)
    }
}

struct CirclePostLink: Decodable, Sendable {
    let post_id: String
}

struct FeedFollow: Decodable, Sendable {
    let follower_id: String
    let following_id: String
    let accepted: Bool
}
