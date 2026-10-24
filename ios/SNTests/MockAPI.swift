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
    private var refreshGate: CheckedContinuation<Void, Never>?
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
        refreshGate?.resume()
        refreshGate = nil
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
        return try loginResult.get()
    }

    func refresh(refreshToken: String) async throws -> TokenPair {
        refreshCount += 1
        if holdRefresh {
            await withCheckedContinuation { continuation in
                refreshGate = continuation
                refreshStarted?.resume()
                refreshStarted = nil
            }
        }
        if refreshDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: refreshDelayNanoseconds)
        }
        return try refreshResult.get()
    }

    func verifyMfa(accessToken: String, factorId: String, code: String) async throws -> TokenPair {
        try mfaResult.get()
    }

    func logout(accessToken: String) async throws {
        logoutCount += 1
        logoutTokens.append(accessToken)
    }

    func posts(accessToken: String, before: String, postId: String?) async throws -> FeedPage {
        postCursors.append(before)
        return try postsResult.get()
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

    func bootstrap(accessToken: String) async throws -> Bootstrap {
        try bootstrapResult.get()
    }
}

final class MemoryTokenStore: TokenStore {
    var tokens: TokenPair?
    func load() -> TokenPair? { tokens }
    func save(_ tokens: TokenPair) throws { self.tokens = tokens }
    func clear() { tokens = nil }
}
