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
        if let original = image.jpegData(compressionQuality: 0.9) {
            do {
                let jpeg = try await PhotoPreparation.prepareJPEG(data: original)
                let prepared = UIImage(data: jpeg)
                record("photo_resized_1600_and_under_3MiB", prepared.map {
                    max($0.size.width * $0.scale, $0.size.height * $0.scale) <= 1600
                } == true && jpeg.count <= 3 * 1024 * 1024)
            } catch { record("photo_resized_1600_and_under_3MiB", false) }
            let cancelled = Task { try await PhotoPreparation.prepareJPEG(data: original) }
            cancelled.cancel()
            do {
                _ = try await cancelled.value
                record("cancelled_photo_preparation_has_no_result", false)
            } catch is CancellationError { record("cancelled_photo_preparation_has_no_result", true) }
            catch { record("cancelled_photo_preparation_has_no_result", false) }
        } else { record("photo_resized_1600_and_under_3MiB", false) }
        do {
            _ = try await PhotoPreparation.prepareJPEG(data: Data([1, 2, 3]))
            record("invalid_photo_bytes_rejected", false)
        } catch { record("invalid_photo_bytes_rejected", true) }

        let store = KeychainTokenStore(service: "it.sn.app.m1-verification", account: UUID().uuidString)
        defer { store.clear() }
        let pair = TokenPair(accessToken: "synthetic-access", refreshToken: "synthetic-refresh",
            expiresAt: Int(Date().timeIntervalSince1970) + 3600, tokenType: "bearer")
        do {
            try store.save(pair)
            record("isolated_keychain_roundtrip", store.load() == pair)
            var pendingPair = pair
            pendingPair.pendingMfaFactorId = "synthetic-factor"
            try store.save(pendingPair)
            record("isolated_keychain_update_preserves_mfa", store.load() == pendingPair)
            let rotated = TokenPair(accessToken: "synthetic-rotated-access", refreshToken: "synthetic-rotated-refresh",
                expiresAt: pair.expiresAt + 3600, tokenType: "bearer")
            try store.save(rotated)
            record("isolated_keychain_rotation_clears_pending_mfa", store.load() == rotated)
            store.clear()
            record("isolated_keychain_clear", store.load() == nil)
        } catch { record("isolated_keychain_roundtrip", false) }
        await coordinator.logout()
        record("logout_clears_feed_profile", coordinator.feed.isEmpty && coordinator.profilePosts.isEmpty && coordinator.state == .signedOut)

        let pendingMfa = M1HTTPFixture.coordinator(screen: "mfa")
        await pendingMfa.restore()
        record("restored_mfa_keeps_feed_closed", pendingMfa.state == .mfaRequired(factorId: "fixture-factor") && pendingMfa.feed.isEmpty)
        await pendingMfa.verifyMfa(code: " 123456 ")
        record("pasted_mfa_code_opens_fixture_feed", pendingMfa.homePosts.count == 40)
        await pendingMfa.logout()
        record("mfa_logout_returns_to_login", pendingMfa.state == .signedOut)
        let failedStorage = M1HTTPFixture.coordinator(screen: "storage")
        await failedStorage.restore()
        record("storage_failure_keeps_memory_session", failedStorage.sessionStorageNeedsRetry && !failedStorage.offline && failedStorage.homePosts.count == 40)
        let storageRequests = M1HTTPFixture.control.requests.count
        failedStorage.retrySessionStorage()
        record("storage_retry_never_sends_auth_requests", M1HTTPFixture.control.requests.count == storageRequests && failedStorage.sessionStorageNeedsRetry)
        await failedStorage.logout()
        record("logout_clears_storage_warning", !failedStorage.sessionStorageNeedsRetry)

        let report: [String: Any] = ["platform": "ios-device", "transport": "URLSession with synthetic URLProtocol",
            "run_id": ProcessInfo.processInfo.environment["SN_M1_CHECK_RUN_ID"] ?? "",
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
