import Foundation

struct StoryAuthor: Decodable, Sendable {
    let id: String
    let username: String
    let display_name: String
}

struct NativeStory: Decodable, Identifiable, Sendable {
    let id: String
    let author_id: String
    let body: String
    let media_path: String?
    let media_type: String?
    let alt: String?
    let content_warning: String?
    let created_at: String
    let expires_at: String
    let author: StoryAuthor?
    let media: [FeedMedia]?
    let viewed: Bool

    var expiry: Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: expires_at) ?? ISO8601DateFormatter().date(from: expires_at)
    }
    func isActive(at now: Date) -> Bool { expiry.map { $0 > now } ?? false }
    var photo: FeedMedia? {
        if let first = media?.sorted(by: { $0.position < $1.position }).first {
            return first.media_type?.hasPrefix("image/") == true ? first : nil
        }
        guard let media_path, media_type?.hasPrefix("image/") == true else { return nil }
        return FeedMedia(id: id, media_path: media_path, media_type: media_type, alt: alt ?? "", position: 0)
    }
    func mayLoadPhoto(at now: Date, revealed: Bool, active: Bool) -> Bool {
        isActive(at: now) && photo != nil && active && (warning == nil || revealed)
    }
    var authorName: String {
        guard let author else { return "Storia" }
        return author.display_name.isEmpty ? "@\(author.username)" : author.display_name
    }
    var warning: String? {
        guard let content_warning, !content_warning.isEmpty else { return nil }
        return content_warning
    }
}

struct NativeStoriesPage: Decodable, Sendable {
    let stories: [NativeStory]
    let nextCursor: PostCursor?
}

/// Pure clock policy: callers supply elapsed monotonic time and current wall time.
struct StoryPlayback {
    private(set) var elapsed: TimeInterval = 0
    private(set) var expired = false
    private(set) var finished = false
    var progress: Double { min(elapsed / 5, 1) }

    mutating func advance(by delta: TimeInterval, now: Date, story: NativeStory,
                          ready: Bool, revealed: Bool, paused: Bool, active: Bool, voiceOver: Bool) -> Bool {
        guard story.isActive(at: now) else { expired = true; return false }
        guard !expired, !finished, ready, revealed, !paused, active, !voiceOver,
              delta.isFinite, delta > 0 else { return false }
        elapsed = min(elapsed + delta, 5)
        if elapsed >= 5 { finished = true; return true }
        return false
    }
}
