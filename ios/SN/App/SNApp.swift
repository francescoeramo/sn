import SwiftUI

@main
struct SNApp: App {
    @StateObject private var coordinator = AuthCoordinator(
        api: APIClient(baseURL: AppConfig.apiBaseURL),
        store: KeychainTokenStore()
    )

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(coordinator)
        }
    }
}
