import Foundation

/// Errore delle API native. `code` è il codice stabile emesso dal server (`native/auth/*`).
enum APIError: Error, Equatable, Sendable {
    case transport
    case unauthorized(code: String?)
    case server(status: Int, message: String, code: String?)

    var code: String? {
        switch self {
        case .transport: return "auth_unavailable"
        case .unauthorized(let code): return code
        case .server(_, _, let code): return code
        }
    }

    var isUnauthorized: Bool {
        switch self {
        case .unauthorized: return true
        case .server(let status, _, _): return status == 401
        case .transport: return false
        }
    }

    /// La sessione non è più valida sul server: si esce dall'account (R4).
    var isDefinitiveSessionFailure: Bool {
        code == "refresh_invalid" || code == "session_invalid"
    }

    /// Errore di rete/transitorio: i token restano, l'app non esce (R4, F5).
    var isConnectivityFailure: Bool {
        code == "auth_unavailable"
    }
}

struct APIErrorBody: Decodable {
    let error: String?
    let code: String?
}
