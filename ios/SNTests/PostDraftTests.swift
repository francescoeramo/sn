import XCTest
@testable import SN

final class PostDraftTests: XCTestCase {
    func testOldPhotoCompletionCannotPublishOrStopNewSelection() {
        var draft = PostDraft()
        draft.body = "Testo"
        let old = draft.selectPhoto(present: true)
        let latest = draft.selectPhoto(present: true)
        XCTAssertFalse(draft.finishPhoto(Data([1]), revision: old))
        XCTAssertTrue(draft.preparing)
        XCTAssertFalse(draft.canPublish)
        XCTAssertFalse(draft.finishPhoto(nil, revision: old))
        XCTAssertTrue(draft.preparing)
        XCTAssertTrue(draft.finishPhoto(Data([2]), revision: latest))
        XCTAssertEqual(draft.jpeg, Data([2]))
        XCTAssertTrue(draft.canPublish)
    }

    func testRemovalInvalidatesPendingPhotoAndPreviousUpload() {
        var draft = PostDraft()
        let revision = draft.selectPhoto(present: true)
        draft.uploadedPath = "previous-upload"
        draft.alt = "Vecchia descrizione"
        draft.selectPhoto(present: false)
        XCTAssertFalse(draft.finishPhoto(Data([1]), revision: revision))
        XCTAssertNil(draft.jpeg)
        XCTAssertNil(draft.uploadedPath)
        XCTAssertTrue(draft.alt.isEmpty)
        XCTAssertFalse(draft.hasChanges)
        XCTAssertFalse(draft.canPublish)
    }

    func testFailedReplacementDoesNotReusePreviousPhoto() {
        var draft = PostDraft()
        let first = draft.selectPhoto(present: true)
        draft.finishPhoto(Data([1]), revision: first)
        draft.uploadedPath = "uploaded-first"
        let second = draft.selectPhoto(present: true)
        XCTAssertTrue(draft.hasChanges)
        draft.finishPhoto(nil, revision: second)
        XCTAssertNil(draft.jpeg)
        XCTAssertNil(draft.uploadedPath)
        XCTAssertFalse(draft.canPublish)
    }

    func testWarningUsesServerTrimAndUTF16Limits() {
        var draft = PostDraft()
        draft.body = "Testo"
        draft.warningEnabled = true
        draft.contentWarning = " \n "
        XCTAssertFalse(draft.canPublish)
        draft.contentWarning = "  " + String(repeating: "😀", count: 80) + " \n"
        XCTAssertTrue(draft.canPublish)
        XCTAssertEqual(draft.warning.utf16.count, 160)
        draft.contentWarning += "😀"
        XCTAssertFalse(draft.canPublish)
        draft.warningEnabled = false
        XCTAssertTrue(draft.canPublish)
        XCTAssertEqual(draft.warning, "")
    }
}
