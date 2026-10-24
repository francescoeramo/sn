import Foundation

/// Composer state stays in memory. Only the latest photo selection may complete.
struct PostDraft {
    var body = ""
    var alt = ""
    var warningEnabled = false
    var contentWarning = ""
    private(set) var jpeg: Data?
    var uploadedPath: String?
    private(set) var preparing = false
    private var photoRevision = 0

    var warning: String {
        warningEnabled ? contentWarning.trimmingCharacters(in: .whitespacesAndNewlines) : ""
    }

    var hasChanges: Bool {
        !body.isEmpty || jpeg != nil || preparing || !contentWarning.isEmpty
    }

    var canPublish: Bool {
        !preparing && body.utf16.count <= 2200 && alt.utf16.count <= 300
            && (!body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || jpeg != nil)
            && (!warningEnabled || (!warning.isEmpty && warning.utf16.count <= 160))
    }

    /// Synchronous invalidation, before starting/cancelling any asynchronous load.
    @discardableResult
    mutating func selectPhoto(present: Bool) -> Int {
        photoRevision += 1
        jpeg = nil
        uploadedPath = nil
        alt = ""
        preparing = present
        return photoRevision
    }

    /// A late completion (including failure) cannot clear a newer loading state.
    @discardableResult
    mutating func finishPhoto(_ data: Data?, revision: Int) -> Bool {
        guard photoRevision == revision else { return false }
        jpeg = data
        preparing = false
        return true
    }
}
