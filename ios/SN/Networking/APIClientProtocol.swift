import Foundation

protocol APIClientProtocol: Sendable {
    func login(email: String, password: String) async throws -> LoginResponse
    func refresh(refreshToken: String) async throws -> TokenPair
    func verifyMfa(accessToken: String, factorId: String, code: String) async throws -> TokenPair
    func logout(accessToken: String) async throws
    func bootstrap(accessToken: String) async throws -> Bootstrap
    func posts(accessToken: String, before: String, postId: String?) async throws -> FeedPage
    func profilePosts(accessToken: String, before: PostCursor?) async throws -> ProfilePostsPage
    func stories(accessToken: String, before: PostCursor?) async throws -> NativeStoriesPage
    func media(accessToken: String, path: String) async throws -> Data
    func upload(accessToken: String, jpeg: Data) async throws -> UploadedMedia
    func publish(accessToken: String, post: NewPost) async throws
}

