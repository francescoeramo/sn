import Foundation

protocol APIClientProtocol: Sendable {
    func login(email: String, password: String) async throws -> LoginResponse
    func refresh(refreshToken: String) async throws -> TokenPair
    func verifyMfa(accessToken: String, factorId: String, code: String) async throws -> TokenPair
    func logout(accessToken: String) async throws
    func bootstrap(accessToken: String) async throws -> Bootstrap
}

/// Client HTTP verso il server SN. Il bearer è passato esplicitamente dai chiamanti:
/// il client non conosce cookie né stato di sessione.
struct APIClient: APIClientProtocol {
    let baseURL: URL
    var session: URLSession = .shared

    private var encoder: JSONEncoder { JSONEncoder() }
    private var decoder: JSONDecoder { JSONDecoder() }

    func login(email: String, password: String) async throws -> LoginResponse {
        let body = try encoder.encode(LoginRequest(email: email, password: password))
        let data = try await request(path: "/api/native/auth/login", method: "POST", token: nil, body: body)
        return try decode(LoginResponse.self, from: data)
    }

    func refresh(refreshToken: String) async throws -> TokenPair {
        let body = try encoder.encode(RefreshRequest(refreshToken: refreshToken))
        let data = try await request(path: "/api/native/auth/refresh", method: "POST", token: nil, body: body)
        return try decode(TokenPair.self, from: data)
    }

    func verifyMfa(accessToken: String, factorId: String, code: String) async throws -> TokenPair {
        let body = try encoder.encode(MfaRequest(factorId: factorId, code: code))
        let data = try await request(path: "/api/native/auth/mfa", method: "POST", token: accessToken, body: body)
        return try decode(TokenPair.self, from: data)
    }

    func logout(accessToken: String) async throws {
        let body = try encoder.encode(EmptyBody())
        _ = try await request(path: "/api/native/auth/logout", method: "POST", token: accessToken, body: body)
    }

    func bootstrap(accessToken: String) async throws -> Bootstrap {
        let data = try await request(path: "/api/bootstrap", method: "GET", token: accessToken, body: nil)
        return try decode(Bootstrap.self, from: data)
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIError.transport
        }
    }

    private func request(path: String, method: String, token: String?, body: Data?) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw APIError.transport }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            // Rete assente o timeout: ambiguo, non implica un rifiuto del server (R4).
            throw APIError.transport
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.transport }
        guard (200..<300).contains(http.statusCode) else {
            let body = try? decoder.decode(APIErrorBody.self, from: data)
            if http.statusCode == 401 {
                throw APIError.unauthorized(code: body?.code)
            }
            throw APIError.server(
                status: http.statusCode,
                message: body?.error ?? "Errore del server.",
                code: body?.code
            )
        }
        return data
    }
}
