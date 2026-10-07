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
        let probe = Task { await coordinator.probe() }
        try? await Task.sleep(nanoseconds: 40_000_000) // lascia partire il rinnovo
        await coordinator.logout()
        await probe.value

        XCTAssertEqual(coordinator.state, .signedOut, "una risposta tardiva non deve riattivare l'utente")
        XCTAssertNil(store.tokens)
        let logoutCount = await api.logoutCount
        XCTAssertEqual(logoutCount, 1, "il logout deve revocare la sessione sul server")
    }
}
