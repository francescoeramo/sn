#if DEBUG
import Foundation
import SNChatCrypto

/// M0.5: no chat UI, no credentials and no network calls. Only synthetic vectors.
/// The report can be pulled from this development app's container over USB.
enum CryptoProbeDiagnostics {
    static func run() async {
        await Task.detached(priority: .utility) {
            do {
                let folder = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask,
                    appropriateFor: nil, create: true)
                let url = folder.appendingPathComponent("crypto-interop-report.json")
                let report: Data
                do {
                    report = try ChatInteropProbe.run()
                } catch {
                    // No key material, token, or real user content in the report or logs.
                    report = Data(#"{"status":"failed","platform":"ios-cryptokit"}"#.utf8)
                }
                try report.write(to: url, options: [.atomic, .completeFileProtection])
            } catch {
                // Diagnostics must not prevent the existing authentication flow.
                print("M0.5: report crittografico non disponibile.")
            }
        }.value
    }
}
#endif
