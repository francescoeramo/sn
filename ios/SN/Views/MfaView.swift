import SwiftUI

struct MfaView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    @State private var code = ""

    var body: some View {
        Form {
            if coordinator.sessionStorageNeedsRetry {
                Section { SessionStorageNotice() }
            }
            Section("Verifica in due passaggi") {
                Text("Inserisci il codice a 6 cifre dell'app authenticator.")
                    .font(.footnote)
                    .foregroundStyle(.primary)
                TextField("Codice", text: $code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .disabled(coordinator.isAuthenticating)
                    .accessibilityLabel("Codice a 6 cifre")
                    .onSubmit { submit() }
            }
            if let message = coordinator.lastErrorMessage {
                Text(message).foregroundStyle(.red)
            }
            Button("Verifica") { submit() }
            .disabled(MfaCode.normalized(code) == nil || coordinator.isAuthenticating)
            if coordinator.isAuthenticating { ProgressView("Verifica…") }
            Section {
                Button("Torna all’accesso", role: .destructive) {
                    Task { await coordinator.logout() }
                }
            } footer: {
                Text("Interrompe questa verifica e ti permette di accedere con un altro account.")
            }
        }
    }

    private func submit() {
        guard MfaCode.normalized(code) != nil, !coordinator.isAuthenticating else { return }
        Task { await coordinator.verifyMfa(code: code) }
    }
}
