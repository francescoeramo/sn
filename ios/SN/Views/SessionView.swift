import SwiftUI

struct SessionView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    let me: Me?

    var body: some View {
        List {
            Section {
                Text("Qui puoi verificare la connessione al tuo account o uscire da SN.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
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
            if let verifiedAt = coordinator.lastVerifiedAt {
                Label {
                    Text("Sessione verificata alle \(verifiedAt.formatted(date: .omitted, time: .standard))")
                } icon: {
                    Image(systemName: "checkmark.circle")
                }
                .accessibilityAddTraits(.updatesFrequently)
            }
            Button {
                Task { await coordinator.probe() }
            } label: {
                if coordinator.isProbing {
                    HStack {
                        ProgressView()
                        Text("Verifica in corso…")
                    }
                } else {
                    Text("Verifica sessione")
                }
            }
            .disabled(coordinator.isProbing)
            Button("Esci", role: .destructive) {
                Task { await coordinator.logout() }
            }
        }
    }
}
