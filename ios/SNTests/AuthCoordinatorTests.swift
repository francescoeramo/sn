import XCTest
@testable import SN

@MainActor
final class AuthCoordinatorTests: XCTestCase {
    private func tokens(expiresIn: TimeInterval = 3600) -> TokenPair {
        TokenPair(
            accessToken: "access-\(UUID().uuidString)",
            refreshToken: "refresh-\(UUID().uuidString)",
            expiresAt: Int(Date().timeIntervalSince1970 + expiresIn),
            tokenType: "bearer"
        )
    }

    private func bootstrap() -> Bootstrap {
        Bootstrap(userId: "user-id", me: Me(id: "user-id", username: "francesco", displayName: "Francesco"))
    }

    func testConcurrentRestoreUsesSingleFlightRefresh() async {
        let api = MockAPI()
        await api.setRefreshDelay(nanoseconds: 120_000_000)
        await api.setRefreshResult(.success(tokens()))
        await api.setBootstrapResult(.success(bootstrap()))
        let store = MemoryTokenStore()
        store.tokens = tokens(expiresIn: -10) // scaduto → rinnovo proattivo

        let coordinator = AuthCoordinator(api: api, store: store)
        let first = Task { await coordinator.restore() }
        let second = Task { await coordinator.restore() }
        _ = await (first.value, second.value)

        let count = await api.refreshCount
        XCTAssertEqual(count, 1, "due restore concorrenti devono condividere una sola richiesta di rinnovo")
    }

    func testRefreshInvalidSignsOutAndClearsStore() async {
        let api = MockAPI()
        await api.setRefreshResult(.failure(APIError.unauthorized(code: "refresh_invalid")))
        let store = MemoryTokenStore()
        store.tokens = tokens(expiresIn: -10)

        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()

        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertNil(store.tokens)
    }

    func testProbeConfirmsSuccessAndClearsPreviousError() async {
        let api = MockAPI()
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore() // il mock inizialmente simula un errore di rete
        XCTAssertNotNil(coordinator.lastErrorMessage)
        XCTAssertNil(coordinator.lastVerifiedAt)

        await api.setBootstrapResult(.success(bootstrap()))
        await coordinator.probe()

        XCTAssertEqual(coordinator.state, .signedIn(me: bootstrap().me))
        XCTAssertNotNil(coordinator.lastVerifiedAt)
        XCTAssertNil(coordinator.lastErrorMessage)
        XCTAssertFalse(coordinator.offline)
        XCTAssertFalse(coordinator.isProbing)
    }

    func testFailedProbeRemovesPreviousSuccess() async {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        XCTAssertNotNil(coordinator.lastVerifiedAt)

        await api.setBootstrapResult(.failure(.transport))
        await coordinator.probe()

        XCTAssertNil(coordinator.lastVerifiedAt)
        XCTAssertNotNil(coordinator.lastErrorMessage)
        XCTAssertFalse(coordinator.isProbing)
        XCTAssertNotNil(store.tokens)
    }

    func testConnectivityFailureKeepsSession() async {
        let api = MockAPI()
        await api.setRefreshResult(.failure(.transport))
        let store = MemoryTokenStore()
        store.tokens = tokens(expiresIn: -10)

        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()

        XCTAssertTrue(coordinator.offline)
        XCTAssertNotNil(store.tokens, "un errore di rete non deve cancellare i token")
        if case .signedIn = coordinator.state {} else { XCTFail("la sessione deve restare conservata") }
    }

    func testLogoutDuringRefreshKeepsUserSignedOut() async {
        let api = MockAPI()
        await api.setRefreshDelay(nanoseconds: 200_000_000)
        await api.setRefreshResult(.success(tokens()))
        await api.setBootstrapResult(.success(bootstrap()))
        let store = MemoryTokenStore()
        store.tokens = tokens(expiresIn: -10)

        let coordinator = AuthCoordinator(api: api, store: store)
        let probe = Task { await coordinator.restore() }
        try? await Task.sleep(nanoseconds: 40_000_000) // lascia partire il rinnovo
        await coordinator.logout()
        await probe.value

        XCTAssertEqual(coordinator.state, .signedOut, "una risposta tardiva non deve riattivare l'utente")
        XCTAssertNil(store.tokens)
        let logoutCount = await api.logoutCount
        XCTAssertEqual(logoutCount, 1, "il logout deve revocare la sessione sul server")
    }
    func testLogoutClearsLocalSessionBeforeRefreshCompletes() async {
        let api = MockAPI()
        let rotated = tokens()
        await api.suspendRefresh()
        await api.setRefreshResult(.success(rotated))
        let store = MemoryTokenStore()
        store.tokens = tokens(expiresIn: -10)
        let coordinator = AuthCoordinator(api: api, store: store)
        let restoring = Task { await coordinator.restore() }
        await api.waitForRefresh()
        let loggingOut = Task { await coordinator.logout() }
        // The logout task yields while awaiting the held refresh.
        for _ in 0..<100 where coordinator.state != .signedOut { await Task.yield() }
        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertNil(store.tokens)
        let beforeRelease = await api.logoutCount
        XCTAssertEqual(beforeRelease, 0)
        await api.releaseRefresh()
        await loggingOut.value
        await restoring.value
        let revoked = await api.logoutTokens
        XCTAssertEqual(revoked, [rotated.accessToken])
        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertNil(store.tokens)
    }

    func testLateOfflineRefreshCannotRestoreLoggedOutSession() async {
        let api = MockAPI()
        await api.suspendRefresh()
        await api.setRefreshResult(.failure(.transport))
        let store = MemoryTokenStore()
        store.tokens = tokens(expiresIn: -10)
        let coordinator = AuthCoordinator(api: api, store: store)
        let restoring = Task { await coordinator.restore() }
        await api.waitForRefresh()
        let loggingOut = Task { await coordinator.logout() }
        for _ in 0..<100 where coordinator.state != .signedOut { await Task.yield() }
        await api.releaseRefresh()
        await loggingOut.value
        await restoring.value
        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertFalse(coordinator.offline)
        XCTAssertNil(store.tokens)
    }

    private func post(_ id: String, author: String = "user-id", circle: Bool = false) -> FeedPost {
        FeedPost(id: id, author_id: author, body: id, kind: "post", media_path: nil,
                 media_type: nil, alt: "", created_at: "2026-10-23T12:30:00Z",
                 content_warning: nil, media: nil,
                 circle_links: circle ? [CirclePostLink(post_id: id)] : nil)
    }

    func testPaginationAppendsWithoutDuplicatesAndStopsAtEnd() async {
        let api = MockAPI()
        var initial = bootstrap()
        initial.posts = [post("first")]
        initial.nextCursor = "cursor-1"
        await api.setBootstrapResult(.success(initial))
        await api.setPostsResult(.success(FeedPage(posts: [post("first"), post("older")], nextCursor: nil)))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        await coordinator.loadMore()
        await coordinator.loadMore()
        XCTAssertEqual(coordinator.homePosts.map(\.id), ["first", "older"])
        XCTAssertNil(coordinator.nextCursor)
        let cursors = await api.postCursors
        XCTAssertEqual(cursors, ["cursor-1"])
    }

    func testPaginationOfflinePreservesPostsCursorAndSession() async {
        let api = MockAPI()
        var initial = bootstrap()
        initial.posts = [post("first")]
        initial.nextCursor = "cursor-1"
        await api.setBootstrapResult(.success(initial))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        await coordinator.loadMore()
        XCTAssertEqual(coordinator.feed.map(\.id), ["first"])
        XCTAssertEqual(coordinator.nextCursor, "cursor-1")
        XCTAssertTrue(coordinator.offline)
        XCTAssertNotNil(store.tokens)
        XCTAssertFalse(coordinator.isLoadingMore)
        await api.setPostsResult(.success(FeedPage(posts: [post("older")], nextCursor: nil)))
        await coordinator.loadMore()
        XCTAssertEqual(coordinator.homePosts.map(\.id), ["first", "older"])
        XCTAssertEqual(coordinator.connectionGeneration, 1)
        XCTAssertFalse(coordinator.offline)
        XCTAssertNil(coordinator.lastErrorMessage)
    }

    func testHomeFeedExcludesUnfollowedPendingAndCirclePosts() async {
        let api = MockAPI()
        var initial = bootstrap()
        initial.posts = [post("mine"), post("followed", author: "friend"),
                         post("pending", author: "pending"), post("stranger", author: "other"),
                         post("circle", circle: true), post("linked-circle")]
        initial.follows = [FeedFollow(follower_id: "user-id", following_id: "friend", accepted: true),
                           FeedFollow(follower_id: "user-id", following_id: "pending", accepted: false)]
        initial.circlePosts = [CirclePostLink(post_id: "linked-circle")]
        await api.setBootstrapResult(.success(initial))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        XCTAssertEqual(coordinator.homePosts.map(\.id), ["mine", "followed"])
    }

    func testSuccessfulImageClearsOfflineBannerWithoutFeedReload() async throws {
        let api = MockAPI()
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore() // bootstrap fails offline
        XCTAssertTrue(coordinator.offline)
        XCTAssertNotNil(coordinator.lastErrorMessage)
        await api.setMediaResult(.success(Data([1, 2, 3])))
        _ = try await coordinator.image(path: "photo")
        XCTAssertFalse(coordinator.offline)
        XCTAssertNil(coordinator.lastErrorMessage)
    }

    func testRepeatedImageUsesSessionMemoryAndLogoutClearsIt() async throws {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        await api.setMediaResult(.success(Data([1, 2, 3])))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        async let first = coordinator.image(path: "photo")
        async let second = coordinator.image(path: "photo")
        _ = try await (first, second)
        _ = try await coordinator.image(path: "photo")
        let count = await api.mediaCount
        XCTAssertEqual(count, 1)
        await coordinator.logout()
        do {
            _ = try await coordinator.image(path: "photo")
            XCTFail("logout must remove cached private images")
        } catch { }
    }

    func testCachedImageDoesNotPretendConnectionRecovered() async throws {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        await api.setMediaResult(.success(Data([1])))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        _ = try await coordinator.image(path: "photo")
        await api.setBootstrapResult(.failure(.transport))
        await coordinator.probe()
        _ = try await coordinator.image(path: "photo")
        XCTAssertTrue(coordinator.offline)
        XCTAssertNotNil(coordinator.lastErrorMessage)
    }

    func testOfflineRecoveryRechecksServerAndClearsBanner() async {
        let api = MockAPI()
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        XCTAssertTrue(coordinator.offline)
        await api.setBootstrapResult(.success(bootstrap()))
        await coordinator.recoverConnection()
        XCTAssertFalse(coordinator.offline)
        XCTAssertNil(coordinator.lastErrorMessage)
        XCTAssertNotNil(coordinator.lastVerifiedAt)
        XCTAssertEqual(coordinator.connectionGeneration, 1)
    }

    func testCancelledRecoveryDoesNotClearOfflineBanner() async {
        let api = MockAPI()
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        let recovery = Task { await coordinator.recoverConnection() }
        recovery.cancel()
        await recovery.value
        XCTAssertTrue(coordinator.offline)
        XCTAssertNotNil(coordinator.lastErrorMessage)
    }

}
