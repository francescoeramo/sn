#if DEBUG
import XCTest
@testable import SN

@MainActor
final class M1HTTPTests: XCTestCase {
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
