#if DEBUG
import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Opt-in test transport. Reserved .invalid host; no cloud, real tokens or real posts.
final class M1HTTPFixture: URLProtocol, @unchecked Sendable {
    static let userId = "00000000-0000-4000-8000-000000000001"
    static let timestamp = "2026-10-24T09:00:00.123456+00:00"
    static let control = Control()

    @MainActor
    static func coordinator(screen: String? = nil) -> AuthCoordinator {
        control.reset()
        control.setWarningFixture(screen == "warning")
        control.setStoriesFixture(screen == "stories")
        let store = FixtureStore(screen: screen)
        let defaults = UserDefaults(suiteName: "it.sn.m1-fixture")!
        defaults.removePersistentDomain(forName: "it.sn.m1-fixture")
        return AuthCoordinator(api: client(), store: store, defaults: defaults)
    }

    private final class FixtureStore: TokenStore {
        var tokens: TokenPair? = TokenPair(accessToken: "m1-fixture", refreshToken: "fixture-refresh",
            expiresAt: Int(Date().timeIntervalSince1970) + 3600, tokenType: "bearer")
        private let failWrites: Bool
        private enum StoreError: Error { case unavailable }
        init(screen: String?) {
            failWrites = screen == "storage"
            if failWrites {
                tokens = TokenPair(accessToken: "m1-fixture", refreshToken: "fixture-refresh",
                    expiresAt: Int(Date().timeIntervalSince1970) - 120, tokenType: "bearer")
            }
            if screen == "login" { tokens = nil }
            if screen == "mfa" { tokens?.pendingMfaFactorId = "fixture-factor" }
        }
        func load() -> TokenPair? { tokens }
        func save(_ value: TokenPair) throws {
            if failWrites { throw StoreError.unavailable }
            tokens = value
        }
        func clear() { tokens = nil }
    }

    final class Control: @unchecked Sendable {
        private let lock = NSLock()
        private var disconnected = false
        private var malformed = false
        private var showWarning = false
        private var showStories = false
        private var paths: [String] = []
        private var contractValid = true

        func reset() { lock.withLock { disconnected = false; malformed = false; showWarning = false; showStories = false; paths = []; contractValid = true } }
        func setWarningFixture(_ value: Bool) { lock.withLock { showWarning = value } }
        func setStoriesFixture(_ value: Bool) { lock.withLock { showStories = value } }
        var storiesFixture: Bool { lock.withLock { showStories } }
        var warningFixture: Bool { lock.withLock { showWarning } }
        func setOffline(_ value: Bool) { lock.withLock { disconnected = value } }
        func setMalformedResponse(_ value: Bool) { lock.withLock { malformed = value } }
        var malformedResponse: Bool { lock.withLock { malformed } }
        var requests: [String] { lock.withLock { paths } }
        var validRequests: Bool { lock.withLock { contractValid } }
        func receive(_ request: URLRequest) throws {
            try lock.withLock {
                paths.append(request.url!.path + (request.url!.query.map { "?" + $0 } ?? ""))
                if showStories, ProcessInfo.processInfo.environment["SN_M1_UI_FIXTURE"] == "1",
                   let runId = ProcessInfo.processInfo.environment["SN_M2_UI_RUN_ID"],
                   let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                    let report: [String: Any] = ["run_id": runId, "requests": paths]
                    if let data = try? JSONSerialization.data(withJSONObject: report) {
                        try? data.write(to: directory.appendingPathComponent("m2-ui-network.json"), options: .atomic)
                    }
                }
                let expectedBearer = ["/api/native/auth/login", "/api/native/auth/refresh"].contains(request.url?.path ?? "") ? nil : "Bearer m1-fixture"
                contractValid = contractValid && request.value(forHTTPHeaderField: "Authorization") == expectedBearer
                    && !request.httpShouldHandleCookies && request.cachePolicy == .reloadIgnoringLocalCacheData
                if disconnected { throw URLError(.notConnectedToInternet) }
            }
        }
    }

    static func client() -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [M1HTTPFixture.self]
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        return APIClient(baseURL: URL(string: "https://sn-m1.invalid")!, session: URLSession(configuration: configuration))
    }

    static func posts() -> [[String: Any]] {
        (1...85).reversed().map { index in
            ["id": String(format: "00000000-0000-4000-8000-%012d", index),
             "author_id": userId, "body": index == 85 && control.warningFixture ? "Testo sotto avviso" : String(format: "Post collaudo %03d", index),
             "kind": "post", "media_path": NSNull(), "media_type": NSNull(), "alt": "",
             "created_at": timestamp, "content_warning": index == 85 && control.warningFixture ? "Avviso di collaudo" : "", "media": [], "circle_links": []]
        }
    }

    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "sn-m1.invalid" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            try Self.control.receive(request)
            let url = request.url!
            if url.path == "/api/media" {
                let data = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=")!
                let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil,
                    headerFields: ["Content-Type": "image/png"])!
                client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                client?.urlProtocol(self, didLoad: data)
                client?.urlProtocolDidFinishLoading(self)
                return
            }
            let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
            let params = Dictionary(uniqueKeysWithValues: query.map { ($0.name, $0.value ?? "") })
            var rows = Self.posts()
            if let id = params["post_id"] { rows = rows.filter { ($0["id"] as! String) < id } }
            else if params["before"] != nil { rows = [] } // Legacy timestamp-only cursor skips ties.
            let page = Array(rows.prefix(40))
            var payload: [String: Any]
            if ["/api/native/auth/login", "/api/native/auth/mfa", "/api/native/auth/refresh"].contains(url.path) {
                payload = ["access_token": "m1-fixture", "refresh_token": "fixture-refresh",
                    "expires_at": Int(Date().timeIntervalSince1970) + 3600, "token_type": "bearer"]
                if url.path == "/api/native/auth/login" {
                    payload["mfa_required"] = true
                    payload["factor_id"] = "fixture-factor"
                }
            } else if url.path == "/api/native/bootstrap" {
                payload = ["user_id": Self.userId,
                    "me": ["id": Self.userId, "username": "collaudo", "display_name": "Collaudo M1"],
                    "profiles": [["id": Self.userId, "username": "collaudo", "display_name": "Collaudo M1", "bio": "Dati sintetici locali"]],
                    "posts": page, "nextCursor": Self.timestamp, "nextPostId": page.last!["id"]!]
            } else if url.path == "/api/posts" {
                payload = ["posts": page, "nextCursor": rows.count > 40 ? Self.timestamp : NSNull(),
                           "nextPostId": rows.count > 40 ? page.last!["id"]! : NSNull()]
            } else if url.path == "/api/profile/posts" {
                payload = ["posts": page, "nextCursor": rows.count > 40
                    ? ["created_at": Self.timestamp, "post_id": page.last!["id"]!] : NSNull()]
            } else if url.path == "/api/native/stories" {
                let expires = ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600))
                let items: [[String: Any]] = Self.control.storiesFixture ? (1...2).map { index in
                    ["id": "story-fixture-\(index)", "author_id": Self.userId,
                     "body": "Testo storia sintetica \(index)", "media_path": "fixture/story-\(index).png",
                     "media_type": "image/png", "alt": "Foto sintetica \(index)",
                     "content_warning": index == 1 ? "Avviso storia sintetica" : "Avviso seconda storia",
                     "created_at": Self.timestamp, "expires_at": expires,
                     "author": ["id": Self.userId, "username": "collaudo", "display_name": index == 1 ? "Storia prova" : "Seconda storia"],
                     "media": [], "viewed": false]
                } : []
                payload = ["stories": items, "nextCursor": NSNull()]
            } else if url.path == "/api/native/upload" {
                payload = ["path": "fixture-photo", "mime": "image/jpeg"]
            } else if url.path == "/api/native/post" || url.path == "/api/native/auth/logout" {
                payload = ["ok": true]
            } else {
                throw URLError(.unsupportedURL)
            }
            let data = Self.control.malformedResponse ? Data("{\"invalid\":".utf8)
                : try JSONSerialization.data(withJSONObject: payload)
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json", "Cache-Control": "private, no-store"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}
#endif
