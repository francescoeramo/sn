import SwiftUI

@main
struct SNApp: App {
    @StateObject private var coordinator: AuthCoordinator

    init() {
        #if DEBUG
        if ProcessInfo.processInfo.environment["SN_M1_UI_FIXTURE"] == "1" {
            _coordinator = StateObject(wrappedValue: M1HTTPFixture.coordinator(screen: ProcessInfo.processInfo.environment["SN_M1_FIXTURE_SCREEN"]))
            return
        }
        #endif
        _coordinator = StateObject(wrappedValue: AuthCoordinator(
            api: APIClient(baseURL: AppConfig.apiBaseURL), store: KeychainTokenStore()))
    }

    #if DEBUG
    private var fixtureStateLabel: String {
        guard ProcessInfo.processInfo.environment["SN_M1_FIXTURE_SCREEN"] != nil else { return "" }
        switch coordinator.state {
        case .loading: return " · Attesa"
        case .signedOut: return " · Accesso"
        case .mfaRequired: return " · MFA"
        case .signedIn: return " · Feed"
        }
    }
    #endif

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(coordinator)
                #if DEBUG
                .overlay(alignment: .topLeading) {
                    if ProcessInfo.processInfo.environment["SN_M1_UI_FIXTURE"] == "1" {
                        Text("Collaudo M1 · dati locali" + fixtureStateLabel)
                            .font(.caption2).padding(4)
                            .foregroundStyle(.primary)
                            .background(Color(uiColor: .systemBackground))
                            .allowsHitTesting(false)
                    }
                }
                #endif
        }
    }
}
