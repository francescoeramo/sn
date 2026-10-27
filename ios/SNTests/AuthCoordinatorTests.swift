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

    private func loginResponse(_ pair: TokenPair, mfa: Bool = false) -> LoginResponse {
        LoginResponse(mfaRequired: mfa, factorId: mfa ? "fixture-factor" : nil,
            accessToken: pair.accessToken, refreshToken: pair.refreshToken,
            expiresAt: pair.expiresAt, tokenType: pair.tokenType)
    }

    func testOldRefreshCompletionCannotDetachNewSessionRefresh() async throws {
        for oldResult: Result<TokenPair, APIError> in [.success(tokens()), .failure(.transport)] {
            let api = MockAPI()
            let store = MemoryTokenStore()
            store.tokens = tokens(expiresIn: -120)
            await api.suspendRefresh()
            await api.setRefreshResult(oldResult)
            let coordinator = AuthCoordinator(api: api, store: store)
            let restoring = Task { await coordinator.restore() }
            await api.waitForRefresh()
            let logout = Task { await coordinator.logout() }
            for _ in 0..<100 where coordinator.state != .signedOut { await Task.yield() }
            await api.setLoginResult(.success(loginResponse(tokens(expiresIn: -120))))
            await api.setRefreshResult(.success(tokens()))
            await api.setBootstrapResult(.success(bootstrap()))
            await api.setMediaResult(.success(Data([1, 2, 3])))
            let login = Task { await coordinator.login(email: "fixture@example.invalid", password: "fixture") }
            for _ in 0..<1000 {
                if await api.refreshCount == 2 { break }
                await Task.yield()
            }
            let started = await api.refreshCount
            XCTAssertEqual(started, 2)
            await api.releaseRefresh(number: 1)
            await restoring.value
            await logout.value
            let image = Task { try await coordinator.image(path: "fixture/new-session.jpg") }
            for _ in 0..<100 { await Task.yield() }
            let refreshes = await api.refreshCount
            XCTAssertEqual(refreshes, 2, "An old completion must not detach the new refresh")
            await api.releaseRefresh()
            await login.value
            _ = try await image.value
            XCTAssertNotNil(store.tokens)
        }
    }

    func testNewLoginLoadsFeedWhileOldBootstrapIsStillPending() async {
        let api = MockAPI()
        let store = MemoryTokenStore()
        store.tokens = tokens()
        await api.setBootstrapResult(.success(bootstrap()))
        await api.suspendBootstrap()
        let coordinator = AuthCoordinator(api: api, store: store)
        let restoring = Task { await coordinator.restore() }
        await api.waitForBootstrap()
        await coordinator.logout()
        XCTAssertFalse(coordinator.isProbing, "Logout releases the old session's loading state")
        await api.setLoginResult(.success(loginResponse(tokens())))
        await coordinator.login(email: "fixture@example.invalid", password: "fixture")
        let reads = await api.bootstrapCount
        XCTAssertEqual(reads, 2, "The old request must not block the new session")
        XCTAssertEqual(coordinator.state, .signedIn(me: bootstrap().me))
        await api.releaseBootstrap()
        await restoring.value
        XCTAssertEqual(coordinator.state, .signedIn(me: bootstrap().me))
    }

    func testOldBootstrapUnauthorizedCannotRefreshNewLogin() async {
        let api = MockAPI()
        let store = MemoryTokenStore()
        store.tokens = tokens()
        await api.setBootstrapResult(.failure(.unauthorized(code: nil)))
        await api.suspendBootstrap()
        let coordinator = AuthCoordinator(api: api, store: store)
        let restoring = Task { await coordinator.restore() }
        await api.waitForBootstrap()
        await coordinator.logout()
        await api.setLoginResult(.success(loginResponse(tokens())))
        await api.setBootstrapResult(.success(bootstrap()))
        let login = Task { await coordinator.login(email: "fixture@example.invalid", password: "fixture") }
        for _ in 0..<100 where !coordinator.isAuthenticating { await Task.yield() }
        for _ in 0..<100 { await Task.yield() }
        await api.releaseBootstrap()
        await restoring.value
        await login.value
        let refreshes = await api.refreshCount
        XCTAssertEqual(refreshes, 0, "An old response must never refresh a new session")
        XCTAssertNotNil(store.tokens)
    }

    func testPendingMfaSurvivesStorageRoundTripAndRelaunch() async throws {
        let api = MockAPI()
        await api.setLoginResult(.success(loginResponse(tokens(), mfa: true)))
        await api.setBootstrapResult(.success(bootstrap()))
        let store = MemoryTokenStore()
        let first = AuthCoordinator(api: api, store: store)
        await first.login(email: "fixture@example.invalid", password: "fixture")
        let data = try JSONEncoder().encode(XCTUnwrap(store.tokens))
        store.tokens = try JSONDecoder().decode(TokenPair.self, from: data)
        let reopened = AuthCoordinator(api: api, store: store)
        await reopened.restore()
        XCTAssertEqual(reopened.state, .mfaRequired(factorId: "fixture-factor"))
        let beforeVerification = await api.bootstrapCount
        XCTAssertEqual(beforeVerification, 0, "Pending MFA must not open the feed")
        await api.setMfaResult(.success(tokens()))
        await reopened.verifyMfa(code: "123456")
        XCTAssertEqual(reopened.state, .signedIn(me: bootstrap().me))
        let verifiedRelaunch = AuthCoordinator(api: api, store: store)
        await verifiedRelaunch.restore()
        XCTAssertEqual(verifiedRelaunch.state, .signedIn(me: bootstrap().me))
    }

    func testExpiredPendingMfaRefreshesBeforeOneVerification() async {
        let api = MockAPI()
        await api.setLoginResult(.success(loginResponse(tokens(expiresIn: -120), mfa: true)))
        let refreshed = tokens()
        await api.setRefreshResult(.success(refreshed))
        await api.setMfaResult(.success(tokens()))
        await api.setBootstrapResult(.success(bootstrap()))
        let store = MemoryTokenStore()
        let first = AuthCoordinator(api: api, store: store)
        await first.login(email: "fixture@example.invalid", password: "fixture")
        let reopened = AuthCoordinator(api: api, store: store)
        await reopened.restore()
        await reopened.verifyMfa(code: "123456")
        let usedTokens = await api.mfaTokens
        XCTAssertEqual(usedTokens, [refreshed.accessToken])
        let refreshes = await api.refreshCount
        XCTAssertEqual(refreshes, 1)
        XCTAssertEqual(reopened.state, .signedIn(me: bootstrap().me))
    }

    func testPendingMfaRefreshFailureKeepsChallengeWithoutSendingCode() async {
        let api = MockAPI()
        await api.setLoginResult(.success(loginResponse(tokens(expiresIn: -120), mfa: true)))
        let store = MemoryTokenStore()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.login(email: "fixture@example.invalid", password: "fixture")
        await coordinator.verifyMfa(code: "123456")
        XCTAssertEqual(coordinator.state, .mfaRequired(factorId: "fixture-factor"))
        XCTAssertNotNil(store.tokens)
        let verifications = await api.mfaCount
        XCTAssertEqual(verifications, 0)
        XCTAssertNotNil(coordinator.lastErrorMessage)
    }

    func testPendingMfaMarkerSurvivesRefreshAndRejectedCode() async {
        let api = MockAPI()
        await api.setLoginResult(.success(loginResponse(tokens(expiresIn: -120), mfa: true)))
        await api.setRefreshResult(.success(tokens()))
        await api.setMfaResult(.failure(.server(status: 400, message: "Invalid", code: "mfa_invalid")))
        let store = MemoryTokenStore()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.login(email: "fixture@example.invalid", password: "fixture")
        await coordinator.verifyMfa(code: "123456")
        let reopened = AuthCoordinator(api: api, store: store)
        await reopened.restore()
        XCTAssertEqual(reopened.state, .mfaRequired(factorId: "fixture-factor"))
        let bootstraps = await api.bootstrapCount
        XCTAssertEqual(bootstraps, 0)
    }

    func testInvalidPendingMfaRefreshReturnsToLoginWithoutSendingCode() async {
        let api = MockAPI()
        await api.setLoginResult(.success(loginResponse(tokens(expiresIn: -120), mfa: true)))
        await api.setRefreshResult(.failure(.unauthorized(code: "refresh_invalid")))
        let store = MemoryTokenStore()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.login(email: "fixture@example.invalid", password: "fixture")
        await coordinator.verifyMfa(code: "123456")
        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertNil(store.tokens)
        let verifications = await api.mfaCount
        XCTAssertEqual(verifications, 0)
    }

    func testRepeatedLoginAndMfaSubmissionsSendOneRequestAtATime() async {
        let api = MockAPI()
        await api.setLoginResult(.success(loginResponse(tokens(), mfa: true)))
        await api.suspendAuthentication()
        let coordinator = AuthCoordinator(api: api, store: MemoryTokenStore())
        let login = Task { await coordinator.login(email: "fixture@example.invalid", password: "fixture") }
        await api.waitForAuthentication()
        XCTAssertTrue(coordinator.isAuthenticating)
        let duplicate = Task { await coordinator.login(email: "fixture@example.invalid", password: "fixture") }
        for _ in 0..<20 { await Task.yield() }
        await api.releaseAuthentication()
        await login.value
        await duplicate.value
        let logins = await api.loginCount
        XCTAssertEqual(logins, 1)
        XCTAssertFalse(coordinator.isAuthenticating)

        await api.setMfaResult(.failure(.server(status: 400, message: "Invalid", code: "mfa_invalid")))
        await api.suspendAuthentication()
        let verification = Task { await coordinator.verifyMfa(code: "123456") }
        await api.waitForAuthentication()
        XCTAssertTrue(coordinator.isAuthenticating)
        let duplicateVerification = Task { await coordinator.verifyMfa(code: "123456") }
        for _ in 0..<20 { await Task.yield() }
        await api.releaseAuthentication()
        await verification.value
        await duplicateVerification.value
        let verifications = await api.mfaCount
        XCTAssertEqual(verifications, 1)
        XCTAssertFalse(coordinator.isAuthenticating)
        XCTAssertEqual(coordinator.state, .mfaRequired(factorId: "fixture-factor"))
    }

    func testLateLoginSuccessAfterLogoutIsRevokedWithoutRestoringSession() async {
        let api = MockAPI()
        let pair = tokens()
        await api.setLoginResult(.success(loginResponse(pair)))
        await api.setBootstrapResult(.success(bootstrap()))
        await api.suspendAuthentication()
        let store = MemoryTokenStore()
        let coordinator = AuthCoordinator(api: api, store: store)
        let login = Task { await coordinator.login(email: "fixture@example.invalid", password: "fixture") }
        await api.waitForAuthentication()
        await coordinator.logout()
        await api.releaseAuthentication()
        await login.value
        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertNil(store.tokens)
        let revoked = await api.logoutTokens
        XCTAssertEqual(revoked, [pair.accessToken])
        XCTAssertNil(coordinator.lastErrorMessage)
    }

    func testLateLoginFailureAfterLogoutDoesNotSetAnError() async {
        let api = MockAPI()
        await api.suspendAuthentication()
        let coordinator = AuthCoordinator(api: api, store: MemoryTokenStore())
        let login = Task { await coordinator.login(email: "fixture@example.invalid", password: "fixture") }
        await api.waitForAuthentication()
        await coordinator.logout()
        await api.releaseAuthentication()
        await login.value
        XCTAssertNil(coordinator.lastErrorMessage)
        XCTAssertEqual(coordinator.state, .signedOut)
    }

    func testLateMfaSuccessAfterLogoutIsRevokedWithoutRestoringSession() async {
        let api = MockAPI()
        await api.setLoginResult(.success(loginResponse(tokens(), mfa: true)))
        await api.setBootstrapResult(.success(bootstrap()))
        let verified = tokens()
        await api.setMfaResult(.success(verified))
        let store = MemoryTokenStore()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.login(email: "fixture@example.invalid", password: "fixture")
        await api.suspendAuthentication()
        let verification = Task { await coordinator.verifyMfa(code: "123456") }
        await api.waitForAuthentication()
        await coordinator.logout()
        await api.releaseAuthentication()
        await verification.value
        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertNil(store.tokens)
        let revoked = await api.logoutTokens
        XCTAssertTrue(revoked.contains(verified.accessToken))
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

    func testPublishPreservesContentWarning() async throws {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        try await coordinator.sendPost(body: "Contenuto", alt: "", path: nil, contentWarning: "Tema sensibile")
        let sent = await api.publishedPosts
        XCTAssertEqual(sent.count, 1)
        let data = try JSONEncoder().encode(try XCTUnwrap(sent.first))
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(object["content_warning"] as? String, "Tema sensibile")
        XCTAssertTrue(object["media_path"] is NSNull)
    }

    func testAmbiguousPublicationIsNotAutomaticallyRetried() async {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        await api.setPublishResult(.failure(.transport))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        do {
            try await coordinator.sendPost(body: "Contenuto", alt: "", path: nil, contentWarning: "Avviso")
            XCTFail("lost response must remain uncertain")
        } catch { }
        let sent = await api.publishedPosts
        XCTAssertEqual(sent.count, 1)
        XCTAssertTrue(coordinator.offline)
        XCTAssertNotNil(store.tokens)
    }

    func testRejectedPublicationClearsInvalidSessionWithoutRetry() async {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        await api.setPublishResult(.failure(.unauthorized(code: "session_invalid")))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        do {
            try await coordinator.sendPost(body: "Testo", alt: "", path: nil)
            XCTFail("must reject invalid session")
        } catch { }
        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertNil(store.tokens)
        let sent = await api.publishedPosts
        let refreshes = await api.refreshCount
        XCTAssertEqual(sent.count, 1)
        XCTAssertEqual(refreshes, 0, "a rejected write must not be refreshed and repeated")
    }

    func testOfflineUploadKeepsTokensAndSuccessfulUploadRecoversConnection() async throws {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        do {
            _ = try await coordinator.uploadPhoto(jpeg: Data([1]), uploaded: nil)
            XCTFail("offline upload must fail")
        } catch { }
        XCTAssertTrue(coordinator.offline)
        XCTAssertNotNil(store.tokens)
        let failedAttempts = await api.uploadCount
        XCTAssertEqual(failedAttempts, 1)
        await api.setUploadResult(.success(UploadedMedia(path: "uploaded", mime: "image/jpeg")))
        let path = try await coordinator.uploadPhoto(jpeg: Data([1]), uploaded: nil)
        XCTAssertEqual(path, "uploaded")
        XCTAssertFalse(coordinator.offline)
        XCTAssertNil(coordinator.lastErrorMessage)
        _ = try await coordinator.uploadPhoto(jpeg: Data([1]), uploaded: path)
        let totalAttempts = await api.uploadCount
        XCTAssertEqual(totalAttempts, 2, "known upload paths are reused")
    }

    func testLatePublicationErrorCannotChangeLoggedOutState() async {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        await api.setPublishResult(.failure(.transport))
        await api.suspendPublish()
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        let sending = Task {
            do {
                try await coordinator.sendPost(body: "Testo", alt: "", path: nil)
                XCTFail("must remain cancelled after logout")
            } catch is CancellationError { }
            catch { XCTFail("late errors must be ignored after logout") }
        }
        await api.waitForPublish()
        await coordinator.logout()
        await api.releasePublish()
        await sending.value
        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertFalse(coordinator.offline)
        XCTAssertNil(coordinator.lastErrorMessage)
    }

    func testProfileArchiveHasIndependentPaginationAndRefresh() async {
        let api = MockAPI()
        var initial = bootstrap()
        initial.posts = [post("feed-only", author: "friend")]
        initial.nextCursor = "feed-cursor"
        await api.setBootstrapResult(.success(initial))
        let cursor = PostCursor(created_at: "2026-10-24T09:00:00Z", post_id: "mine")
        await api.setProfilePostsResult(.success(ProfilePostsPage(posts: [post("mine")], nextCursor: cursor)))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        await coordinator.loadProfile()
        await api.setProfilePostsResult(.success(ProfilePostsPage(posts: [post("mine"), post("older"), post("older")], nextCursor: nil)))
        await coordinator.loadProfile()
        await coordinator.loadProfile() // the last page is terminal
        XCTAssertEqual(coordinator.profilePosts.map(\.id), ["mine", "older"])
        XCTAssertEqual(coordinator.feed.map(\.id), ["feed-only"])
        XCTAssertEqual(coordinator.nextCursor, "feed-cursor")
        let cursors = await api.profileCursors
        XCTAssertEqual(cursors, [nil, cursor])
        await api.setProfilePostsResult(.success(ProfilePostsPage(posts: [post("new")], nextCursor: nil)))
        await coordinator.loadProfile(refresh: true)
        XCTAssertEqual(coordinator.profilePosts.map(\.id), ["new"])
        await coordinator.logout()
        XCTAssertTrue(coordinator.profilePosts.isEmpty)
        XCTAssertFalse(coordinator.profileHasLoaded)
        XCTAssertNil(coordinator.profileNextCursor)
    }

    func testFailedProfilePageKeepsArchiveAndCursorForRetry() async {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        let cursor = PostCursor(created_at: "2026-10-24T09:00:00Z", post_id: "mine")
        await api.setProfilePostsResult(.success(ProfilePostsPage(posts: [post("mine")], nextCursor: cursor)))
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        await coordinator.loadProfile()
        await api.setProfilePostsResult(.failure(.transport))
        await coordinator.loadProfile()
        XCTAssertEqual(coordinator.profilePosts.map(\.id), ["mine"])
        XCTAssertEqual(coordinator.profileNextCursor, cursor)
        XCTAssertNotNil(coordinator.profileError)
        XCTAssertFalse(coordinator.isLoadingProfile)
        XCTAssertNotNil(store.tokens)
        await api.setProfilePostsResult(.success(ProfilePostsPage(posts: [post("older")], nextCursor: nil)))
        await coordinator.loadProfile()
        XCTAssertEqual(coordinator.profilePosts.map(\.id), ["mine", "older"])
        XCTAssertNil(coordinator.profileError)
        XCTAssertFalse(coordinator.offline)
    }

    func testLateProfileResponseAfterLogoutIsDiscarded() async {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        await api.setProfilePostsResult(.success(ProfilePostsPage(posts: [post("private")], nextCursor: nil)))
        await api.suspendProfile()
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        let loading = Task { await coordinator.loadProfile() }
        await api.waitForProfile()
        await coordinator.logout()
        await api.releaseProfile()
        await loading.value
        XCTAssertEqual(coordinator.state, .signedOut)
        XCTAssertTrue(coordinator.profilePosts.isEmpty)
        XCTAssertFalse(coordinator.profileHasLoaded)
        XCTAssertFalse(coordinator.isLoadingProfile)
        XCTAssertNil(coordinator.profileError)
    }

    func testPublicationDuringProfileLoadRefreshesStaleArchive() async throws {
        let api = MockAPI()
        await api.setBootstrapResult(.success(bootstrap()))
        await api.setProfilePostsResult(.success(ProfilePostsPage(posts: [post("old")], nextCursor: nil)))
        await api.suspendProfile()
        let store = MemoryTokenStore()
        store.tokens = tokens()
        let coordinator = AuthCoordinator(api: api, store: store)
        await coordinator.restore()
        let loading = Task { await coordinator.loadProfile() }
        await api.waitForProfile()
        try await coordinator.sendPost(body: "Nuovo", alt: "", path: nil)
        await api.setProfilePostsResult(.success(ProfilePostsPage(posts: [post("new"), post("old")], nextCursor: nil)))
        await api.releaseProfile()
        await loading.value
        for _ in 0..<100 {
            if coordinator.profilePosts.first?.id == "new" { break }
            await Task.yield()
        }
        XCTAssertEqual(coordinator.profilePosts.map(\.id), ["new", "old"])
    }

}
