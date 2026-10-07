import SwiftUI

struct SessionView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    let me: Me?

    var body: some View {
        List {
            if coordinator.offline {
                Label("Sessione conservata, connessione assente", systemImage: "wifi.slash")
                    .foregroundStyle(.orange)
            }
            Section("Sessione") {
                Text(me?.displayName ?? me?.username ?? "Utente")
                if let username = me?.username {
                    Text("@\(username)").font(.footnote).foregroundStyle(.secondary)
                }
                if let id = me?.id {
                    Text(id).font(.caption2).foregroundStyle(.secondary)
                }
            }
            if let message = coordinator.lastErrorMessage {
                Text(message).foregroundStyle(.red)
            }
            Button("Verifica sessione") {
                Task { await coordinator.probe() }
            }
            Button("Esci", role: .destructive) {
                Task { await coordinator.logout() }
            }
        }
    }
}
