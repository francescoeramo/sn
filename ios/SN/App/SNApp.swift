import SwiftUI

@main
struct SNApp: App {
    @StateObject private var coordinator: AuthCoordinator

    init() {
        #if DEBUG
        if ProcessInfo.processInfo.environment["SN_M1_UI_FIXTURE"] == "1" {
            _coordinator = StateObject(wrappedValue: M1HTTPFixture.coordinator())
            return
        }
        #endif
        _coordinator = StateObject(wrappedValue: AuthCoordinator(
            api: APIClient(baseURL: AppConfig.apiBaseURL), store: KeychainTokenStore()))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(coordinator)
                #if DEBUG
                .overlay(alignment: .topLeading) {
                    if ProcessInfo.processInfo.environment["SN_M1_UI_FIXTURE"] == "1" {
                        Text("Collaudo M1 · dati locali")
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
