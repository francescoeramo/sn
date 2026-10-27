import SwiftUI

struct RootView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    @Environment(\.scenePhase) private var scenePhase
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
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { coordinator.retrySessionStorage() }
        }
        .task(id: scenePhase == .active && coordinator.offline) {
            guard scenePhase == .active, coordinator.offline else { return }
            await coordinator.recoverConnection()
        }
        .task {
            guard !didRestore else { return }
            didRestore = true
            #if DEBUG
            if ProcessInfo.processInfo.environment["SN_RUN_M1_CHECKS"] == "1" {
                await M1DeviceChecks.run()
            } else if ProcessInfo.processInfo.environment["SN_M1_UI_FIXTURE"] != "1" {
                await CryptoProbeDiagnostics.run()
            }
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

/// Shared inline notice: keep system navigation and safe areas available.
struct SessionStorageNotice: View {
    @EnvironmentObject private var coordinator: AuthCoordinator

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Sessione non salvata", systemImage: "exclamationmark.triangle")
                .font(.headline)
            Text("Non riesco a salvare la sessione sul dispositivo. Alla riapertura potresti dover accedere di nuovo.")
                .font(.footnote)
            Button("Riprova il salvataggio") { coordinator.retrySessionStorage() }
        }
        .foregroundStyle(.primary)
    }
}
