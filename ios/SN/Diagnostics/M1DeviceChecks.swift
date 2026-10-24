#if DEBUG && canImport(UIKit)
import Foundation
import UIKit

/// Explicit launch-only verification on real iOS. Synthetic HTTP and an isolated store.
@MainActor
enum M1DeviceChecks {
    static func run() async {
        var checks: [[String: Any]] = []
        func record(_ name: String, _ passed: Bool) { checks.append(["name": name, "passed": passed]) }
        let coordinator = M1HTTPFixture.coordinator()
        await coordinator.restore()
        record("feed_first_40", coordinator.homePosts.count == 40)
        await coordinator.loadMore()
        record("feed_second_80_same_timestamp", coordinator.homePosts.count == 80)
        await coordinator.loadMore()
        record("feed_third_85_unique", coordinator.homePosts.count == 85 && Set(coordinator.homePosts.map(\.id)).count == 85)
        let terminalRequests = M1HTTPFixture.control.requests.count
        await coordinator.loadMore()
        record("feed_terminal_no_more_requests", coordinator.nextCursor == nil && M1HTTPFixture.control.requests.count == terminalRequests)
        await coordinator.loadProfile()
        record("profile_first_40_independent", coordinator.profilePosts.count == 40 && coordinator.homePosts.count == 85)
        await coordinator.loadProfile()
        record("profile_second_80_same_timestamp", coordinator.profilePosts.count == 80)
        await coordinator.loadProfile()
        record("profile_third_85_terminal", coordinator.profilePosts.count == 85 && coordinator.profileNextCursor == nil)
        M1HTTPFixture.control.setOffline(true)
        await coordinator.probe()
        if case .signedIn = coordinator.state { record("offline_keeps_session_and_posts", coordinator.offline && coordinator.homePosts.count == 85) }
        else { record("offline_keeps_session_and_posts", false) }
        M1HTTPFixture.control.setOffline(false)
        await coordinator.recoverConnection()
        record("foreground_automatic_recovery", !coordinator.offline && coordinator.lastErrorMessage == nil && coordinator.connectionGeneration > 0)
        record("http_bearer_no_cookies_no_cache", M1HTTPFixture.control.validRequests)

        var draft = PostDraft()
        draft.body = "Collaudo"
        let old = draft.selectPhoto(present: true)
        let latest = draft.selectPhoto(present: true)
        record("late_photo_does_not_unlock_publish", !draft.finishPhoto(Data([1]), revision: old) && !draft.canPublish)
        draft.finishPhoto(Data([2]), revision: latest)
        draft.uploadedPath = "fixture-upload"
        draft.alt = "Descrizione sintetica"
        draft.selectPhoto(present: false)
        record("remove_photo_clears_media_upload_alt", draft.jpeg == nil && draft.uploadedPath == nil && draft.alt.isEmpty)
        draft.warningEnabled = true
        draft.contentWarning = String(repeating: "😀", count: 80)
        record("warning_160_utf16_allowed", draft.canPublish)
        draft.contentWarning += "😀"
        record("warning_over_160_utf16_rejected", !draft.canPublish)

        let image = UIGraphicsImageRenderer(size: CGSize(width: 3200, height: 2000)).image { context in
            UIColor.systemBlue.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 3200, height: 2000))
        }
        if let original = image.jpegData(compressionQuality: 0.9),
           let prepared = PhotoPreparation.thumbnail(data: original),
           let jpeg = prepared.jpegData(compressionQuality: 0.8) {
            record("photo_resized_1600_and_under_3MiB", max(prepared.size.width, prepared.size.height) <= 1600 && jpeg.count <= 3 * 1024 * 1024)
        } else { record("photo_resized_1600_and_under_3MiB", false) }

        let store = KeychainTokenStore(service: "it.sn.app.m1-verification", account: UUID().uuidString)
        defer { store.clear() }
        let pair = TokenPair(accessToken: "synthetic-access", refreshToken: "synthetic-refresh",
            expiresAt: Int(Date().timeIntervalSince1970) + 3600, tokenType: "bearer")
        do {
            try store.save(pair)
            record("isolated_keychain_roundtrip", store.load() == pair)
            store.clear()
            record("isolated_keychain_clear", store.load() == nil)
        } catch { record("isolated_keychain_roundtrip", false) }
        await coordinator.logout()
        record("logout_clears_feed_profile", coordinator.feed.isEmpty && coordinator.profilePosts.isEmpty && coordinator.state == .signedOut)

        let report: [String: Any] = ["platform": "ios-device", "transport": "URLSession with synthetic URLProtocol",
            "real_user_data": false, "status": checks.allSatisfy { $0["passed"] as? Bool == true } ? "passed" : "failed",
            "timestamp": ISO8601DateFormatter().string(from: Date()), "checks": checks]
        do {
            let folder = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
                .write(to: folder.appendingPathComponent("m1-device-checks.json"), options: [.atomic, .completeFileProtection])
        } catch { print("M1: rapporto di collaudo non disponibile.") }
        M1HTTPFixture.control.reset()
    }
}
#endif
