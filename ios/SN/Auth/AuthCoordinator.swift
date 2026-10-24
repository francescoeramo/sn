import Combine
import Foundation

/// Coordina sessione nativa, rinnovo single-flight (R3) ed epoch di logout (R6).
/// Le operazioni di login/MFA non vengono mai ritentate automaticamente (R4).
@MainActor
final class AuthCoordinator: ObservableObject {
    enum State: Equatable {
        case loading
        case signedOut
        case mfaRequired(factorId: String)
        case signedIn(me: Me?)
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var offline = false
    @Published var lastErrorMessage: String?
    @Published private(set) var isProbing = false
    @Published private(set) var lastVerifiedAt: Date?

    @Published private(set) var feed: [FeedPost] = []
    @Published private(set) var profiles: [FeedProfile] = []
    @Published private(set) var nextCursor: String?
    @Published private(set) var isLoadingMore = false
    @Published private(set) var connectionGeneration = 0
    private let imageCache: NSCache<NSString, NSData> = {
        let cache = NSCache<NSString, NSData>()
        cache.totalCostLimit = 16 * 1024 * 1024
        cache.countLimit = 24
        return cache
    }()
    private var imageTasks: [String: Task<Data, Error>] = [:]
    private var followedIds: Set<String> = []
    private var currentUserId: String?
    private var circlePostIds: Set<String> = []

    var regularPosts: [FeedPost] { feed.filter { $0.kind == "post" && !circlePostIds.contains($0.id) && ($0.circle_links?.isEmpty ?? true) } }

    var homePosts: [FeedPost] { regularPosts.filter { $0.author_id == currentUserId || followedIds.contains($0.author_id) } }

    private let api: APIClientProtocol
    private let store: TokenStore
    private var tokens: TokenPair?
    private var pendingMfaFactorId: String?
    private var refreshTask: Task<TokenPair, Error>?
    /// R6: incrementato a ogni transizione di sessione. Un refresh che completa dopo non rientra.
    private var epoch = 0
    private let meKey = "sn.me"

    init(api: APIClientProtocol, store: TokenStore) {
        self.api = api
        self.store = store
    }

    // MARK: - Avvio

    func restore() async {
        guard let stored = store.load() else {
            cachedMe = nil
            state = .signedOut
            return
        }
        let restoreEpoch = epoch
        tokens = stored
        if stored.isExpired() {
            do {
                _ = try await performRefresh(expectedEpoch: restoreEpoch)
            } catch let error as APIError {
                guard restoreEpoch == epoch else { return }
                if error.isDefinitiveSessionFailure {
                    resetToSignedOut()
                    return
                }
                markOffline(error)
                return
            } catch is CancellationError {
                // Logout ha invalidato l'epoch durante il rinnovo: nessun rientro.
                return
            } catch {
                guard restoreEpoch == epoch else { return }
                offline = true
                state = .signedIn(me: cachedMe)
                return
            }
        }
        guard restoreEpoch == epoch else { return }
        await probe()
    }

    // MARK: - Login / MFA

    func login(email: String, password: String) async {
        lastErrorMessage = nil
        do {
            let response = try await api.login(email: email, password: password)
            guard let pair = response.tokenPair() else { throw APIError.transport }
            if response.mfaRequired == true, let factorId = response.factorId {
                tokens = pair
                pendingMfaFactorId = factorId
                try? store.save(pair)
                state = .mfaRequired(factorId: factorId)
                return
            }
            commit(pair)
            await probe()
        } catch let error as APIError {
            lastErrorMessage = ErrorMessages.message(for: error)
        } catch {
            lastErrorMessage = ErrorMessages.message(for: .transport)
        }
    }

    func verifyMfa(code: String) async {
        lastErrorMessage = nil
        guard let factorId = pendingMfaFactorId, let accessToken = tokens?.accessToken else {
            state = .signedOut
            return
        }
        do {
            let pair = try await api.verifyMfa(accessToken: accessToken, factorId: factorId, code: code)
            commit(pair)
            pendingMfaFactorId = nil
            await probe()
        } catch let error as APIError {
            lastErrorMessage = ErrorMessages.message(for: error)
        } catch {
            lastErrorMessage = ErrorMessages.message(for: .transport)
        }
    }

    // MARK: - Logout (F2, F4, R6)

    func logout() async {
        let pending = refreshTask
        refreshTask = nil
        epoch += 1
        // F4: uscita locale immediata, anche se il rinnovo è ancora sospeso.
        var revocationToken = tokens?.accessToken
        tokens = nil
        pendingMfaFactorId = nil
        store.clear()
        offline = false
        lastErrorMessage = nil
        clearFeed()
        state = .signedOut
        // F2: attende la rotazione solo per revocare sul server la sessione più recente.
        if let pending {
            let refreshed = try? await pending.value
            if let pair = refreshed {
                revocationToken = pair.accessToken
            }
        }
        if let revocationToken {
            try? await api.logout(accessToken: revocationToken)
        }
    }

    // MARK: - Chiamata protetta (prova di sessione)

    /// R4: solo una lettura idempotente può fare refresh + un retry.
    func probe() async {
        guard !isProbing, !isLoadingMore else { return }
        guard tokens != nil else {
            state = .signedOut
            return
        }
        let probeEpoch = epoch
        isProbing = true
        lastVerifiedAt = nil
        defer { isProbing = false }
        do {
            let bootstrap = try await bootstrapWithRefresh()
            guard probeEpoch == epoch else { return }
            currentUserId = bootstrap.userId
            followedIds = Set(bootstrap.follows.filter { $0.follower_id == bootstrap.userId && $0.accepted }.map(\.following_id))
            circlePostIds = Set(bootstrap.circlePosts.map(\.post_id))
            feed = bootstrap.posts
            profiles = bootstrap.profiles
            nextCursor = bootstrap.nextCursor
            cachedMe = bootstrap.me
            connectionRecovered()
            lastErrorMessage = nil
            lastVerifiedAt = Date()
            state = .signedIn(me: bootstrap.me)
        } catch let error as APIError {
            guard probeEpoch == epoch else { return }
            if error.isDefinitiveSessionFailure {
                resetToSignedOut()
            } else {
                markOffline(error)
            }
        } catch is CancellationError {
            // R6: un rinnovo che completa dopo il logout non deve riattivare l'utente.
            return
        } catch {
            guard probeEpoch == epoch else { return }
            offline = true
            lastErrorMessage = ErrorMessages.message(for: .transport)
            state = .signedIn(me: cachedMe)
        }
    }

    func loadMore() async {
        guard !isLoadingMore, !isProbing, let cursor = nextCursor else { return }
        let requestEpoch = epoch
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let page = try await read { [api] token in
                try await api.posts(accessToken: token, before: cursor)
            }
            guard requestEpoch == epoch else { return }
            let known = Set(feed.map(\.id))
            feed.append(contentsOf: page.posts.filter { !known.contains($0.id) })
            nextCursor = page.nextCursor
            connectionRecovered()
            lastErrorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            guard requestEpoch == epoch else { return }
            handleFeedError(error)
        }
    }

    /// Private media are reused only in memory for this session, never on disk.
    func image(path: String) async throws -> Data {
        guard tokens != nil else { throw APIError.unauthorized(code: "session_invalid") }
        if let cached = imageCache.object(forKey: path as NSString) {
            return cached as Data // A cache hit is not evidence of recovered connectivity.
        }
        let requestEpoch = epoch
        let task: Task<Data, Error>
        if let pending = imageTasks[path] {
            task = pending
        } else {
            task = Task { [weak self] in
                guard let self else { throw CancellationError() }
                return try await self.read { [api = self.api] token in
                    try await api.media(accessToken: token, path: path)
                }
            }
            imageTasks[path] = task
        }
        do {
            let data = try await task.value
            guard requestEpoch == epoch else { throw CancellationError() }
            imageTasks[path] = nil
            imageCache.setObject(data as NSData, forKey: path as NSString, cost: data.count)
            connectionRecovered()
            return data
        } catch {
            guard requestEpoch == epoch else { throw CancellationError() }
            imageTasks[path] = nil
            if let apiError = error as? APIError,
               apiError.isConnectivityFailure || apiError.isDefinitiveSessionFailure {
                handleFeedError(apiError)
            }
            throw error
        }
    }

    /// Retry only a read while the foreground view owns this cancellable task.
    /// A usable network path alone does not prove the SN server is reachable.
    func recoverConnection() async {
        let recoveryEpoch = epoch
        var delay: UInt64 = 3
        while offline && tokens != nil && recoveryEpoch == epoch && !Task.isCancelled {
            do { try await Task.sleep(nanoseconds: delay * 1_000_000_000) }
            catch { return }
            guard recoveryEpoch == epoch, !Task.isCancelled else { return }
            await probe()
            delay = min(delay * 2, 30)
        }
    }

    private func connectionRecovered() {
        if offline {
            offline = false
            lastErrorMessage = nil
            connectionGeneration += 1
        }
    }

    /// Writes are never automatically retried: a lost response may already have committed.
    func uploadPhoto(jpeg: Data?, uploaded: String?) async throws -> String? {
        var path = uploaded
        if path == nil, let jpeg {
            let result = try await write { [api] token in
                try await api.upload(accessToken: token, jpeg: jpeg)
            }
            path = result.path
        }
        return path
    }

    func sendPost(body: String, alt: String, path: String?, contentWarning: String = "") async throws {
        let post = NewPost(body: body, media_path: path, alt: alt, content_warning: contentWarning)
        try await write { [api] token in
            try await api.publish(accessToken: token, post: post)
        }
    }

    /// Proactive refresh is allowed before sending, but a write is attempted only once.
    private func write<T: Sendable>(_ operation: @Sendable (String) async throws -> T) async throws -> T {
        let requestEpoch = epoch
        do {
            let token = try await validAccessToken()
            guard requestEpoch == epoch else { throw CancellationError() }
            try Task.checkCancellation()
            let result = try await operation(token)
            guard requestEpoch == epoch else { throw CancellationError() }
            connectionRecovered()
            lastErrorMessage = nil
            return result
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            guard requestEpoch == epoch else { throw CancellationError() }
            handleFeedError(error)
            throw error
        }
    }

    private func read<T: Sendable>(_ operation: @Sendable (String) async throws -> T) async throws -> T {
        let requestEpoch = epoch
        do {
            let token = try await validAccessToken()
            let result = try await operation(token)
            guard requestEpoch == epoch else { throw CancellationError() }
            return result
        } catch let error as APIError where error.isUnauthorized {
            let pair = try await performRefresh(expectedEpoch: requestEpoch)
            let result = try await operation(pair.accessToken)
            guard requestEpoch == epoch else { throw CancellationError() }
            return result
        }
    }

    private func handleFeedError(_ error: Error) {
        if let error = error as? APIError {
            if error.isDefinitiveSessionFailure { resetToSignedOut() }
            lastErrorMessage = ErrorMessages.message(for: error)
            offline = error.isConnectivityFailure
        } else {
            lastErrorMessage = ErrorMessages.message(for: .transport)
        }
    }

    private func clearFeed() {
        imageTasks.values.forEach { $0.cancel() }
        imageTasks.removeAll()
        imageCache.removeAllObjects()
        feed = []
        circlePostIds = []
        followedIds = []
        currentUserId = nil
        profiles = []
        nextCursor = nil
        cachedMe = nil
        lastVerifiedAt = nil
    }

    // MARK: - Interno

    private func bootstrapWithRefresh() async throws -> Bootstrap {
        do {
            return try await api.bootstrap(accessToken: try await validAccessToken())
        } catch let error as APIError where error.isUnauthorized {
            let pair = try await performRefresh(expectedEpoch: epoch)
            return try await api.bootstrap(accessToken: pair.accessToken)
        }
    }

    private func validAccessToken() async throws -> String {
        guard let current = tokens else {
            throw APIError.unauthorized(code: "session_invalid")
        }
        if current.isExpired() {
            return try await performRefresh(expectedEpoch: epoch).accessToken
        }
        return current.accessToken
    }

    /// Single-flight: una sola richiesta di rinnovo in volo; i chiamanti attendono la stessa Task.
    private func performRefresh(expectedEpoch: Int) async throws -> TokenPair {
        if let inFlight = refreshTask {
            let pair = try await inFlight.value
            guard expectedEpoch == epoch else { throw CancellationError() }
            return pair
        }
        guard let current = tokens else {
            throw APIError.unauthorized(code: "session_invalid")
        }
        let task = Task<TokenPair, Error> { [api] in
            try await api.refresh(refreshToken: current.refreshToken)
        }
        refreshTask = task
        do {
            let pair = try await task.value
            refreshTask = nil
            guard expectedEpoch == epoch else { throw CancellationError() }
            tokens = pair
            try? store.save(pair)
            return pair
        } catch {
            refreshTask = nil
            throw error
        }
    }

    private func commit(_ pair: TokenPair) {
        epoch += 1
        tokens = pair
        try? store.save(pair)
    }

    private func resetToSignedOut() {
        epoch += 1
        refreshTask = nil
        tokens = nil
        pendingMfaFactorId = nil
        store.clear()
        clearFeed()
        offline = false
        state = .signedOut
    }

    private func markOffline(_ error: APIError) {
        // F5: sessione conservata, connessione assente. Nessun logout.
        offline = error.isConnectivityFailure
        lastErrorMessage = ErrorMessages.message(for: error)
        state = .signedIn(me: cachedMe)
    }

    private var cachedMe: Me? {
        get {
            guard let data = UserDefaults.standard.data(forKey: meKey) else { return nil }
            return try? JSONDecoder().decode(Me.self, from: data)
        }
        set {
            if let newValue, let data = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(data, forKey: meKey)
            } else {
                UserDefaults.standard.removeObject(forKey: meKey)
            }
        }
    }
}
