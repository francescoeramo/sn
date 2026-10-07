import SwiftUI

struct RootView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    @State private var didRestore = false

    var body: some View {
        NavigationStack {
            Group {
                switch coordinator.state {
                case .loading:
                    ProgressView()
                case .signedOut:
                    LoginView()
                case .mfaRequired:
                    MfaView()
                case .signedIn(let me):
                    SessionView(me: me)
                }
            }
            .navigationTitle("SN")
        }
        .task {
            guard !didRestore else { return }
            didRestore = true
            await coordinator.restore()
        }
    }
}
