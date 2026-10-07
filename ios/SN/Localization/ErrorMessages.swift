import Foundation

/// Traduce i `code` stabili del server in messaggi it/en. Nessuna logica di dominio duplicata.
enum ErrorMessages {
    enum Language: Hashable { case it, en }

    static var language: Language {
        Locale.current.language.languageCode?.identifier == "en" ? .en : .it
    }

    static func message(for error: APIError) -> String {
        guard let code = error.code else { return fallback(for: error) }
        return table[code]?[language] ?? fallback(for: error)
    }

    private static func fallback(for error: APIError) -> String {
        switch error {
        case .transport:
            return language == .en ? "No connection. Try again." : "Nessuna connessione. Riprova."
        case .unauthorized:
            return language == .en ? "Session expired. Sign in again." : "Sessione scaduta. Accedi di nuovo."
        case .server(_, let message, _):
            return message
        }
    }

    private static let table: [String: [Language: String]] = [
        "login_invalid": [
            .it: "Accesso non riuscito. Controlla email e password.",
            .en: "Sign-in failed. Check your email and password.",
        ],
        "refresh_invalid": [
            .it: "La sessione è scaduta. Accedi di nuovo.",
            .en: "Your session expired. Sign in again.",
        ],
        "session_invalid": [
            .it: "Sessione non valida. Accedi di nuovo.",
            .en: "Invalid session. Sign in again.",
        ],
        "auth_unavailable": [
            .it: "Il servizio non risponde. Riprova tra poco.",
            .en: "The service is unavailable. Try again shortly.",
        ],
        "mfa_required": [
            .it: "Inserisci il codice dell'app authenticator.",
            .en: "Enter the authenticator app code.",
        ],
        "mfa_invalid": [
            .it: "Codice non valido. Riprova.",
            .en: "Invalid code. Try again.",
        ],
        "mfa_unavailable": [
            .it: "Verifica non disponibile. Riprova.",
            .en: "Verification unavailable. Try again.",
        ],
        "logout_failed": [
            .it: "Non è stato possibile chiudere la sessione. Riprova.",
            .en: "Could not close the session. Try again.",
        ],
        "account_unavailable": [
            .it: "Account non disponibile.",
            .en: "Account unavailable.",
        ],
    ]
}
