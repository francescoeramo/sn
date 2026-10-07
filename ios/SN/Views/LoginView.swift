import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var coordinator: AuthCoordinator
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        Form {
            Section("Accedi") {
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password)
                    .textContentType(.password)
            }
            if let message = coordinator.lastErrorMessage {
                Text(message).foregroundStyle(.red)
            }
            Button("Accedi") {
                Task { await coordinator.login(email: email, password: password) }
            }
            .disabled(email.isEmpty || password.isEmpty)
        }
    }
}
