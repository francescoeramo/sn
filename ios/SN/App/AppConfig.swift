import Foundation

/// Configurazione statica dell'app. La base URL del server arriva da `Info.plist` (`SNApiBaseURL`).
enum AppConfig {
    static let apiBaseURL: URL = {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "SNApiBaseURL") as? String,
           let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
           url.scheme != nil {
            return url
        }
        return URL(string: "http://localhost:3000")!
    }()
}
