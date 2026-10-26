import Foundation

/// Errore delle API native. `code` è il codice stabile emesso dal server (`native/auth/*`).
enum APIError: Error, Equatable, Sendable {
    case transport
    case invalidResponse
    case unauthorized(code: String?)
    case server(status: Int, message: String, code: String?)

    var code: String? {
        switch self {
        case .transport: return "connection_unavailable"
        case .invalidResponse: return "invalid_response"
        case .unauthorized(let code): return code
        case .server(_, _, let code): return code
        }
    }

    var isUnauthorized: Bool {
        switch self {
        case .unauthorized: return true
        case .server(let status, _, _): return status == 401
        case .transport, .invalidResponse: return false
        }
    }

    /// La sessione non è più valida sul server: si esce dall'account (R4).
    var isDefinitiveSessionFailure: Bool {
        code == "refresh_invalid" || code == "session_invalid"
    }

    /// Errore di rete/transitorio: i token restano, l'app non esce (R4, F5).
    var isConnectivityFailure: Bool {
        code == "auth_unavailable" || code == "connection_unavailable"
    }

    /// A lost response or timeout may follow a successful commit. Do not offer a blind resend.
    var mayHaveCommitted: Bool {
        switch self {
        case .transport, .invalidResponse: return true
        case .unauthorized: return false
        case .server(let status, _, _): return status == 408 || status >= 500
        }
    }
}

struct APIErrorBody: Decodable {
    let error: String?
    let code: String?
}
