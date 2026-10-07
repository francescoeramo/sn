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
        tokens = stored
        if stored.isExpired() {
            do {
                _ = try await performRefresh(expectedEpoch: epoch)
            } catch let error as APIError {
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
                offline = true
                state = .signedIn(me: cachedMe)
                return
            }
        }
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
        // Attende un rinnovo in volo per revocare con il token più recente, se disponibile.
        var revocationToken = tokens?.accessToken
        if let pending, let pair = try? await pending.value {
            revocationToken = pair.accessToken
        }
        tokens = nil
        pendingMfaFactorId = nil
        // F4: i token locali spariscono subito; la revoca sul server è best-effort.
        store.clear()
        offline = false
        state = .signedOut
        if let revocationToken {
            try? await api.logout(accessToken: revocationToken)
        }
    }

    // MARK: - Chiamata protetta (prova di sessione)

    /// R4: solo una lettura idempotente può fare refresh + un retry.
    func probe() async {
        guard tokens != nil else {
            state = .signedOut
            return
        }
        do {
            let bootstrap = try await bootstrapWithRefresh()
            cachedMe = bootstrap.me
            offline = false
            state = .signedIn(me: bootstrap.me)
        } catch let error as APIError {
            if error.isDefinitiveSessionFailure {
                resetToSignedOut()
            } else {
                markOffline(error)
            }
        } catch is CancellationError {
            // R6: un rinnovo che completa dopo il logout non deve riattivare l'utente.
            return
        } catch {
            offline = true
            state = .signedIn(me: cachedMe)
        }
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
        offline = false
        state = .signedOut
    }

    private func markOffline(_ error: APIError) {
        // F5: sessione conservata, connessione assente. Nessun logout.
        offline = true
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
