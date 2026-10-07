import SwiftUI

struct MfaView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    @State private var code = ""

    var body: some View {
        Form {
            Section("Verifica in due passaggi") {
                Text("Inserisci il codice a 6 cifre dell'app authenticator.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                TextField("Codice", text: $code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
            }
            if let message = coordinator.lastErrorMessage {
                Text(message).foregroundStyle(.red)
            }
            Button("Verifica") {
                Task { await coordinator.verifyMfa(code: code) }
            }
            .disabled(code.count != 6)
        }
    }
}
