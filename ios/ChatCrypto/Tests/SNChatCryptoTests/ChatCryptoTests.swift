import Foundation
import XCTest
@testable import SNChatCrypto

final class ChatCryptoTests: XCTestCase {
    func testProductionWebVectorsAndNativeReplies() throws {
        let report = try ChatInteropProbe.run()
        let value = try XCTUnwrap(JSONSerialization.jsonObject(with: report) as? [String: Any])
        XCTAssertEqual(value["status"] as? String, "passed")
        XCTAssertEqual((value["replies"] as? [Any])?.count, 3)
        XCTAssertGreaterThanOrEqual((value["checks"] as? [String])?.count ?? 0, 30)
    }

    func testNewDeviceHasValidPublicKeyAndDifferentIdentity() throws {
        let a = ChatLocalDevice(userID: "alice"), b = ChatLocalDevice(userID: "alice")
        XCTAssertNotEqual(a.device.id, b.device.id)
        XCTAssertNotEqual(try ChatCrypto.fingerprint(a.device), try ChatCrypto.fingerprint(b.device))
    }
}
