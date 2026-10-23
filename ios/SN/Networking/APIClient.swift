import Foundation

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

    func posts(accessToken: String, before: String) async throws -> FeedPage {
        let data = try await request(path: query("/api/posts", name: "before", value: before), method: "GET", token: accessToken, body: nil)
        return try decode(FeedPage.self, from: data)
    }

    func media(accessToken: String, path: String) async throws -> Data {
        try await request(path: query("/api/media", name: "path", value: path), method: "GET", token: accessToken, body: nil)
    }

    func upload(accessToken: String, jpeg: Data) async throws -> UploadedMedia {
        let boundary = "SN-\(UUID().uuidString)"
        var body = Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8)
        body.append(jpeg)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        let data = try await request(path: "/api/native/upload", method: "POST", token: accessToken, body: body, contentType: "multipart/form-data; boundary=\(boundary)")
        return try decode(UploadedMedia.self, from: data)
    }

    func publish(accessToken: String, post: NewPost) async throws {
        _ = try await request(path: "/api/native/post", method: "POST", token: accessToken, body: encoder.encode(post))
    }

    private func query(_ path: String, name: String, value: String) -> String {
        var components = URLComponents()
        components.path = path
        components.queryItems = [URLQueryItem(name: name, value: value)]
        return components.string!.replacingOccurrences(of: "+", with: "%2B")
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIError.transport
        }
    }

    private func request(path: String, method: String, token: String?, body: Data?, contentType: String = "application/json") async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw APIError.transport }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpShouldHandleCookies = false
        request.timeoutInterval = 30
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
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
