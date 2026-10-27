import XCTest
@testable import SN

@MainActor
final class StoriesTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)
    private func story(_ id: String = "story", expiry: Date? = nil, warning: String? = nil) -> NativeStory {
        NativeStory(id: id, author_id: "me", body: "Foto", media_path: "fixture/photo.png", media_type: "image/png",
            alt: nil, content_warning: warning, created_at: "2026-10-27T10:00:00Z",
            expires_at: ISO8601DateFormatter().string(from: expiry ?? now.addingTimeInterval(60)),
            author: nil, media: nil, viewed: false)
    }
    private func coordinator(_ api: MockAPI) async -> AuthCoordinator {
        let store = MemoryTokenStore()
        store.tokens = TokenPair(accessToken: "access", refreshToken: "refresh",
            expiresAt: Int(Date().timeIntervalSince1970 + 3600), tokenType: "bearer")
        await api.setBootstrapResult(.success(Bootstrap(userId: "me", me: Me(id: "me", username: "fixture", displayName: "Fixture"))))
        let subject = AuthCoordinator(api: api, store: store)
        await subject.restore()
        return subject
    }
    func testClockWaitsForMediaConsentForegroundAndReader() {
        let item = story(warning: "Avviso")
        var clock = StoryPlayback()
        for gate in 0..<5 {
            XCTAssertFalse(clock.advance(by: 10, now: now, story: item,
                ready: gate != 0, revealed: gate != 1, paused: gate == 2,
                active: gate != 3, voiceOver: gate == 4))
            XCTAssertEqual(clock.elapsed, 0)
        }
        XCTAssertFalse(clock.advance(by: 4.9, now: now, story: item,
            ready: true, revealed: true, paused: false, active: true, voiceOver: false))
        XCTAssertTrue(clock.advance(by: 0.1, now: now, story: item,
            ready: true, revealed: true, paused: false, active: true, voiceOver: false))
        XCTAssertEqual(clock.progress, 1)
        XCTAssertFalse(clock.advance(by: 5, now: now, story: item,
            ready: true, revealed: true, paused: false, active: true, voiceOver: false))
    }
    func testExpiryStopsClockAndMediaEvenWhenPausedOrVoiceOverActive() {
        let item = story(expiry: now)
        var clock = StoryPlayback()
        XCTAssertFalse(clock.advance(by: 1, now: now, story: item,
            ready: true, revealed: true, paused: true, active: true, voiceOver: true))
        XCTAssertTrue(clock.expired)
        XCTAssertFalse(item.mayLoadPhoto(at: now, revealed: true, active: true))
        let protected = story(warning: "Avviso")
        XCTAssertFalse(protected.mayLoadPhoto(at: now, revealed: false, active: true))
        XCTAssertFalse(protected.mayLoadPhoto(at: now, revealed: true, active: false))
        XCTAssertTrue(protected.mayLoadPhoto(at: now, revealed: true, active: true))
    }
    func testInvalidClockDeltasDoNotAdvance() {
        var clock = StoryPlayback()
        for delta in [-1, Double.nan, Double.infinity, 0] {
            XCTAssertFalse(clock.advance(by: delta, now: now, story: story(),
                ready: true, revealed: true, paused: false, active: true, voiceOver: false))
        }
        XCTAssertEqual(clock.elapsed, 0)
    }
    func testNullableStoryContractAndInvalidExpiryFailClosed() throws {
        let json = """
        {"stories":[{"id":"s","author_id":"a","body":"","media_path":null,"media_type":null,"alt":null,
        "content_warning":null,"created_at":"2026-10-27T10:00:00Z","expires_at":"invalid",
        "author":null,"media":[],"viewed":false}],"nextCursor":null}
        """
        let page = try JSONDecoder().decode(NativeStoriesPage.self, from: Data(json.utf8))
        XCTAssertNil(page.nextCursor)
        XCTAssertNil(page.stories[0].photo)
        XCTAssertFalse(page.stories[0].isActive(at: now))
    }
    func testStoryPaginationKeepsIndependentCursorAndRetriesWithoutLosingData() async {
        let api = MockAPI()
        let subject = await coordinator(api)
        let expiry = Date().addingTimeInterval(3600)
        let cursor = PostCursor(created_at: "2026-10-27T10:00:00Z", post_id: "first")
        await api.setStoriesResult(.success(NativeStoriesPage(stories: [story("first", expiry: expiry)], nextCursor: cursor)))
        await subject.loadStories()
        await api.setStoriesResult(.failure(.transport))
        await subject.loadStories()
        XCTAssertEqual(subject.stories.map(\.id), ["first"])
        XCTAssertEqual(subject.storiesCursor, cursor)
        XCTAssertNotNil(subject.storiesError)
        await api.setStoriesResult(.success(NativeStoriesPage(stories: [story("first", expiry: expiry), story("second", expiry: expiry)], nextCursor: nil)))
        await subject.loadStories()
        await subject.loadStories()
        XCTAssertEqual(subject.stories.map(\.id), ["first", "second"])
        XCTAssertNil(subject.storiesError)
        XCTAssertNil(subject.storiesCursor)
        let reads = await api.storyCursors
        XCTAssertEqual(reads, [nil, cursor, cursor])
        XCTAssertTrue(subject.profilePosts.isEmpty)
    }
    func testLateStoryResponseAfterLogoutCannotRepopulateMemory() async {
        let api = MockAPI()
        let subject = await coordinator(api)
        await api.setStoriesResult(.success(NativeStoriesPage(stories: [story(expiry: Date().addingTimeInterval(3600))], nextCursor: nil)))
        await api.suspendStories()
        let loading = Task { await subject.loadStories() }
        await api.waitForStories()
        await subject.logout()
        await api.releaseStories()
        await loading.value
        XCTAssertTrue(subject.stories.isEmpty)
        XCTAssertFalse(subject.storiesHaveLoaded)
        XCTAssertFalse(subject.isLoadingStories)
        XCTAssertNil(subject.storiesError)
        XCTAssertEqual(subject.state, .signedOut)
    }
    func testExpiredStoriesAreRemovedAndHTTPReadsDoNotRecordViews() async throws {
        let api = MockAPI()
        let subject = await coordinator(api)
        await api.setStoriesResult(.success(NativeStoriesPage(stories: [story(expiry: Date().addingTimeInterval(-1))], nextCursor: nil)))
        await subject.loadStories()
        XCTAssertTrue(subject.stories.isEmpty)
        #if DEBUG
        M1HTTPFixture.control.reset()
        let cursor = PostCursor(created_at: "2026-10-27T10:00:00+02:00", post_id: "00000000-0000-4000-8000-000000000001")
        let page = try await M1HTTPFixture.client().stories(accessToken: "m1-fixture", before: cursor)
        XCTAssertTrue(page.stories.isEmpty)
        let requests = M1HTTPFixture.control.requests
        XCTAssertEqual(requests.count, 1)
        XCTAssertTrue(requests[0].hasPrefix("/api/native/stories?"))
        XCTAssertTrue(requests[0].contains("%2B02:00"))
        XCTAssertTrue(M1HTTPFixture.control.validRequests)
        #endif
    }
    func testPhotoFixtureDecodesStoriesWithoutPrefetchOrViewWrite() async {
        #if DEBUG
        let subject = M1HTTPFixture.coordinator(screen: "stories")
        await subject.restore()
        await subject.loadStories()
        XCTAssertEqual(subject.stories.count, 2)
        XCTAssertEqual(subject.stories.first?.authorName, "Storia prova")
        XCTAssertNotNil(subject.stories.first?.warning)
        XCTAssertNotNil(subject.stories.first?.photo)
        XCTAssertEqual(M1HTTPFixture.control.requests, ["/api/native/bootstrap", "/api/native/stories"])
        XCTAssertTrue(M1HTTPFixture.control.validRequests)
        #endif
    }

    func testServerFractionalExpiryAndOffsetDescribeTheSameUTCInstant() throws {
        let item = NativeStory(id: "expiry", author_id: "me", body: "", media_path: nil,
            media_type: nil, alt: nil, content_warning: nil, created_at: "2026-10-27T10:00:00+02:00",
            expires_at: "2026-10-27T10:00:00.123456+02:00", author: nil, media: nil, viewed: false)
        let instant = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-10-27T08:00:00Z"))
        let expiry = try XCTUnwrap(item.expiry)
        XCTAssertEqual(expiry.timeIntervalSince(instant), 0.123456, accuracy: 0.001)
        XCTAssertTrue(item.isActive(at: instant))
        XCTAssertFalse(item.isActive(at: instant.addingTimeInterval(0.124)))
    }

}
