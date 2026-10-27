#if DEBUG
import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import SN

@MainActor
final class M1HTTPTests: XCTestCase {
    func testDefaultTransportDisablesHTTPDiskCacheAndCookies() {
        let configuration = APIClient(baseURL: URL(string: "https://sn-m1.invalid")!).session.configuration
        XCTAssertNil(configuration.urlCache)
        XCTAssertNil(configuration.httpCookieStorage)
        XCTAssertFalse(configuration.httpShouldSetCookies)
        XCTAssertEqual(configuration.requestCachePolicy, .reloadIgnoringLocalCacheData)
    }

    func testSyntheticLoginMfaAndCancellationUseOnlyFixtureHTTP() async {
        let coordinator = M1HTTPFixture.coordinator(screen: "login")
        await coordinator.restore()
        XCTAssertEqual(coordinator.state, .signedOut)
        await coordinator.login(email: "fixture@example.invalid", password: "fixture")
        XCTAssertEqual(coordinator.state, .mfaRequired(factorId: "fixture-factor"))
        XCTAssertTrue(coordinator.feed.isEmpty)
        await coordinator.verifyMfa(code: "123456")
        XCTAssertEqual(coordinator.homePosts.count, 40)
        XCTAssertTrue(M1HTTPFixture.control.validRequests)
        XCTAssertEqual(M1HTTPFixture.control.requests,
                       ["/api/native/auth/login", "/api/native/auth/mfa", "/api/bootstrap"])
        let pending = M1HTTPFixture.coordinator(screen: "mfa")
        await pending.restore()
        XCTAssertEqual(pending.state, .mfaRequired(factorId: "fixture-factor"))
        await pending.logout()
        XCTAssertEqual(pending.state, .signedOut)
        XCTAssertEqual(M1HTTPFixture.control.requests, ["/api/native/auth/logout"])
    }

    func testMalformedBootstrapPreservesSessionAndFeedWithoutClaimingNoConnection() async {
        M1HTTPFixture.control.reset()
        let store = MemoryTokenStore()
        store.tokens = TokenPair(accessToken: "m1-fixture", refreshToken: "fixture-refresh",
            expiresAt: Int(Date().timeIntervalSince1970) + 3600, tokenType: "bearer")
        let coordinator = AuthCoordinator(api: M1HTTPFixture.client(), store: store)
        await coordinator.restore()
        let cursor = coordinator.nextCursor
        M1HTTPFixture.control.setMalformedResponse(true)
        await coordinator.probe()
        XCTAssertFalse(coordinator.offline)
        XCTAssertNotNil(store.tokens)
        XCTAssertEqual(coordinator.homePosts.count, 40)
        XCTAssertEqual(coordinator.nextCursor, cursor)
        XCTAssertNotNil(coordinator.lastErrorMessage)
        XCTAssertNotEqual(coordinator.lastErrorMessage, ErrorMessages.message(for: .transport))
        XCTAssertEqual(M1HTTPFixture.control.requests.count, 2)
        M1HTTPFixture.control.setMalformedResponse(false)
        await coordinator.probe()
        XCTAssertNil(coordinator.lastErrorMessage)
        XCTAssertFalse(coordinator.offline)
    }

    func testMalformedUploadResponseIsAmbiguousAndNeverRetried() async {
        M1HTTPFixture.control.reset()
        M1HTTPFixture.control.setMalformedResponse(true)
        do {
            _ = try await M1HTTPFixture.client().upload(accessToken: "m1-fixture", jpeg: Data([1, 2, 3]))
            XCTFail("Malformed response must fail decoding")
        } catch let error as APIError {
            XCTAssertEqual(error.code, "invalid_response")
            XCTAssertFalse(error.isConnectivityFailure)
            XCTAssertTrue(error.mayHaveCommitted)
        } catch { XCTFail("Unexpected error: \(error)") }
        XCTAssertEqual(M1HTTPFixture.control.requests.count, 1)
    }

    func testEightyFiveFeedPostsWithIdenticalTimestampsCrossThreePages() async {
        M1HTTPFixture.control.reset()
        let store = MemoryTokenStore()
        store.tokens = TokenPair(accessToken: "m1-fixture", refreshToken: "fixture-refresh",
            expiresAt: Int(Date().timeIntervalSince1970) + 3600, tokenType: "bearer")
        let coordinator = AuthCoordinator(api: M1HTTPFixture.client(), store: store)
        await coordinator.restore()
        XCTAssertEqual(coordinator.homePosts.count, 40)
        await coordinator.loadMore()
        XCTAssertEqual(coordinator.homePosts.count, 80)
        await coordinator.loadMore()
        XCTAssertEqual(coordinator.homePosts.count, 85)
        XCTAssertEqual(Set(coordinator.homePosts.map(\.id)).count, 85)
        XCTAssertNil(coordinator.nextCursor)
        XCTAssertTrue(M1HTTPFixture.control.validRequests)
    }

    func testProfileHTTPPaginationAndOfflineRecoveryKeepTheSession() async {
        M1HTTPFixture.control.reset()
        let store = MemoryTokenStore()
        store.tokens = TokenPair(accessToken: "m1-fixture", refreshToken: "fixture-refresh",
            expiresAt: Int(Date().timeIntervalSince1970) + 3600, tokenType: "bearer")
        let coordinator = AuthCoordinator(api: M1HTTPFixture.client(), store: store)
        await coordinator.restore()
        await coordinator.loadProfile()
        XCTAssertEqual(coordinator.profilePosts.count, 40)
        M1HTTPFixture.control.setOffline(true)
        await coordinator.loadProfile()
        XCTAssertTrue(coordinator.offline)
        XCTAssertEqual(coordinator.profilePosts.count, 40)
        XCTAssertNotNil(store.tokens)
        M1HTTPFixture.control.setOffline(false)
        await coordinator.loadProfile()
        XCTAssertEqual(coordinator.profilePosts.count, 80)
        await coordinator.loadProfile()
        XCTAssertEqual(coordinator.profilePosts.count, 85)
        XCTAssertNil(coordinator.profileNextCursor)
        XCTAssertFalse(coordinator.offline)
        XCTAssertNil(coordinator.profileError)
        XCTAssertTrue(M1HTTPFixture.control.validRequests)
    }
}

#endif
