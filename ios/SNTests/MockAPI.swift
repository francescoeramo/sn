import Foundation
@testable import SN

actor MockAPI: APIClientProtocol {
    var loginResult: Result<LoginResponse, APIError> = .failure(.transport)
    var refreshResult: Result<TokenPair, APIError> = .failure(.transport)
    var mfaResult: Result<TokenPair, APIError> = .failure(.transport)
    var bootstrapResult: Result<Bootstrap, APIError> = .failure(.transport)
    var mediaResult: Result<Data, APIError> = .failure(.transport)
    var publishResult: Result<Void, APIError> = .success(())
    var uploadResult: Result<UploadedMedia, APIError> = .failure(.transport)
    private var holdAuthentication = false
    private var authenticationGates: [CheckedContinuation<Void, Never>] = []
    private var authenticationStarted: CheckedContinuation<Void, Never>?
    private var authenticationInFlight = false
    func suspendAuthentication() { holdAuthentication = true }
    func waitForAuthentication() async {
        if authenticationInFlight { return }
        await withCheckedContinuation { authenticationStarted = $0 }
    }
    func releaseAuthentication() {
        holdAuthentication = false
        authenticationGates.forEach { $0.resume() }
        authenticationGates = []
    }
    private func authenticationBarrier() async {
        authenticationInFlight = true
        if holdAuthentication {
            await withCheckedContinuation { continuation in
                authenticationGates.append(continuation)
                authenticationStarted?.resume()
                authenticationStarted = nil
            }
        }
        authenticationInFlight = false
    }
    func setMfaResult(_ result: Result<TokenPair, APIError>) { mfaResult = result }
    private(set) var mfaCount = 0
    private(set) var mfaTokens: [String] = []
    private(set) var bootstrapCount = 0
    func setUploadResult(_ result: Result<UploadedMedia, APIError>) { uploadResult = result }
    private(set) var uploadCount = 0
    private var holdPublish = false
    private var publishGate: CheckedContinuation<Void, Never>?
    private var publishStarted: CheckedContinuation<Void, Never>?
    func suspendPublish() { holdPublish = true }
    func waitForPublish() async {
        if !publishedPosts.isEmpty { return }
        await withCheckedContinuation { publishStarted = $0 }
    }
    func releasePublish() {
        holdPublish = false
        publishGate?.resume()
        publishGate = nil
    }
    func setPublishResult(_ result: Result<Void, APIError>) { publishResult = result }
    private(set) var publishedPosts: [NewPost] = []
    private(set) var mediaCount = 0
    func setMediaResult(_ result: Result<Data, APIError>) { mediaResult = result }

    var postsResult: Result<FeedPage, APIError> = .failure(.transport)
    var profilePostsResult: Result<ProfilePostsPage, APIError> = .failure(.transport)
    private(set) var profileCursors: [PostCursor?] = []
    func setProfilePostsResult(_ result: Result<ProfilePostsPage, APIError>) { profilePostsResult = result }
    private var profileGate: CheckedContinuation<Void, Never>?
    private var profileStarted: CheckedContinuation<Void, Never>?
    private var holdProfile = false
    func suspendProfile() { holdProfile = true }
    func waitForProfile() async {
        if !profileCursors.isEmpty { return }
        await withCheckedContinuation { profileStarted = $0 }
    }
    func releaseProfile() {
        holdProfile = false
        profileGate?.resume()
        profileGate = nil
    }
    private(set) var postCursors: [String] = []
    var refreshDelayNanoseconds: UInt64 = 0
    private var refreshGates: [Int: CheckedContinuation<Void, Never>] = [:]
    private var refreshStarted: CheckedContinuation<Void, Never>?
    private var holdRefresh = false
    private(set) var logoutTokens: [String] = []

    func suspendRefresh() { holdRefresh = true }
    func waitForRefresh() async {
        if refreshCount > 0 { return }
        await withCheckedContinuation { refreshStarted = $0 }
    }
    func releaseRefresh() {
        holdRefresh = false
        let gates = refreshGates.values
        refreshGates.removeAll()
        gates.forEach { $0.resume() }
    }

    func releaseRefresh(number: Int) {
        refreshGates.removeValue(forKey: number)?.resume()
    }

    private(set) var loginCount = 0
    private(set) var refreshCount = 0
    private(set) var logoutCount = 0

    func setPostsResult(_ result: Result<FeedPage, APIError>) { postsResult = result }

    func setLoginResult(_ result: Result<LoginResponse, APIError>) { loginResult = result }
    func setRefreshResult(_ result: Result<TokenPair, APIError>) { refreshResult = result }
    func setBootstrapResult(_ result: Result<Bootstrap, APIError>) { bootstrapResult = result }
    func setRefreshDelay(nanoseconds: UInt64) { refreshDelayNanoseconds = nanoseconds }

    func login(email: String, password: String) async throws -> LoginResponse {
        loginCount += 1
        await authenticationBarrier()
        return try loginResult.get()
    }

    func refresh(refreshToken: String) async throws -> TokenPair {
        refreshCount += 1
        let number = refreshCount
        let response = refreshResult
        if holdRefresh {
            await withCheckedContinuation { continuation in
                refreshGates[number] = continuation
                refreshStarted?.resume()
                refreshStarted = nil
            }
        }
        if refreshDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: refreshDelayNanoseconds)
        }
        return try response.get()
    }

    func verifyMfa(accessToken: String, factorId: String, code: String) async throws -> TokenPair {
        mfaCount += 1
        mfaTokens.append(accessToken)
        await authenticationBarrier()
        return try mfaResult.get()
    }

    func logout(accessToken: String) async throws {
        logoutCount += 1
        logoutTokens.append(accessToken)
    }

    private var postsGate: CheckedContinuation<Void, Never>?
    private var postsStarted: CheckedContinuation<Void, Never>?
    private var holdPosts = false
    func suspendPosts() { holdPosts = true }
    func waitForPosts() async {
        if postsGate != nil { return }
        await withCheckedContinuation { postsStarted = $0 }
    }
    func releasePosts() {
        postsGate?.resume()
        postsGate = nil
    }

    func posts(accessToken: String, before: String, postId: String?) async throws -> FeedPage {
        postCursors.append(before)
        let response = postsResult
        if holdPosts {
            holdPosts = false
            await withCheckedContinuation { continuation in
                postsGate = continuation
                postsStarted?.resume()
                postsStarted = nil
            }
        }
        return try response.get()
    }
    func media(accessToken: String, path: String) async throws -> Data {
        mediaCount += 1
        return try mediaResult.get()
    }
    func profilePosts(accessToken: String, before: PostCursor?) async throws -> ProfilePostsPage {
        profileCursors.append(before)
        let response = profilePostsResult
        if holdProfile {
            await withCheckedContinuation { continuation in
                profileGate = continuation
                profileStarted?.resume()
                profileStarted = nil
            }
        }
        return try response.get()
    }
    var storiesResult: Result<NativeStoriesPage, APIError> = .success(NativeStoriesPage(stories: [], nextCursor: nil))
    private(set) var storyCursors: [PostCursor?] = []
    func setStoriesResult(_ result: Result<NativeStoriesPage, APIError>) { storiesResult = result }
    private var storyGate: CheckedContinuation<Void, Never>?
    private var storyStarted: CheckedContinuation<Void, Never>?
    private var holdStories = false
    func suspendStories() { holdStories = true }
    func waitForStories() async {
        if storyGate != nil { return }
        await withCheckedContinuation { storyStarted = $0 }
    }
    func releaseStories() { holdStories = false; storyGate?.resume(); storyGate = nil }
    func stories(accessToken: String, before: PostCursor?) async throws -> NativeStoriesPage {
        storyCursors.append(before)
        let response = storiesResult
        if holdStories {
            await withCheckedContinuation { continuation in
                storyGate = continuation; storyStarted?.resume(); storyStarted = nil
            }
        }
        return try response.get()
    }

    func upload(accessToken: String, jpeg: Data) async throws -> UploadedMedia {
        uploadCount += 1
        return try uploadResult.get()
    }
    func publish(accessToken: String, post: NewPost) async throws {
        publishedPosts.append(post)
        if holdPublish {
            await withCheckedContinuation { continuation in
                publishGate = continuation
                publishStarted?.resume()
                publishStarted = nil
            }
        }
        try publishResult.get()
    }

    private var bootstrapGate: CheckedContinuation<Void, Never>?
    private var bootstrapStarted: CheckedContinuation<Void, Never>?
    private var holdBootstrap = false
    func suspendBootstrap() { holdBootstrap = true }
    func waitForBootstrap() async {
        if bootstrapGate != nil { return }
        await withCheckedContinuation { bootstrapStarted = $0 }
    }
    func releaseBootstrap() {
        holdBootstrap = false
        bootstrapGate?.resume()
        bootstrapGate = nil
    }

    func bootstrap(accessToken: String) async throws -> Bootstrap {
        bootstrapCount += 1
        let response = bootstrapResult
        if holdBootstrap {
            holdBootstrap = false
            await withCheckedContinuation { continuation in
                bootstrapGate = continuation
                bootstrapStarted?.resume()
                bootstrapStarted = nil
            }
        }
        return try response.get()
    }
}

final class MemoryTokenStore: TokenStore {
    var tokens: TokenPair?
    var saveError: Error?
    private(set) var saveAttempts = 0
    func load() -> TokenPair? { tokens }
    func save(_ tokens: TokenPair) throws {
        saveAttempts += 1
        if let saveError { throw saveError }
        self.tokens = tokens
    }
    func clear() { tokens = nil }
}
