import SwiftUI

struct RootView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    @State private var didRestore = false

    var body: some View {
        Group {
            if case .signedIn(let me) = coordinator.state {
                FeedView(me: me)
            } else {
                NavigationStack {
                    authenticationContent
                        .navigationTitle("SN")
                }
            }
        }
        .task {
            guard !didRestore else { return }
            didRestore = true
            #if DEBUG
            await CryptoProbeDiagnostics.run()
            #endif
            await coordinator.restore()
        }
    }

    @ViewBuilder
    private var authenticationContent: some View {
        switch coordinator.state {
        case .loading: ProgressView()
        case .signedOut: LoginView()
        case .mfaRequired: MfaView()
        case .signedIn: EmptyView()
        }
    }
}
