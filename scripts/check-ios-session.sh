#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
check_dir="$(mktemp -d /tmp/sn-session-checks.XXXXXX)"
trap 'rm -rf "$check_dir"' EXIT
mkdir -p "$check_dir/Sources/SN" "$check_dir/Sources/Combine" "$check_dir/Tests/SNTests"
cat > "$check_dir/Package.swift" <<'SWIFT'
// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "SessionChecks", targets: [
    .target(name: "Combine"),
    .target(name: "SN", dependencies: ["Combine"]),
    .testTarget(name: "SNTests", dependencies: ["SN"]),
])
SWIFT
cat > "$check_dir/Sources/Combine/Combine.swift" <<'SWIFT'
// Value storage only. No publisher or UI behavior is tested by this shim.
public protocol ObservableObject: AnyObject {}
@propertyWrapper public struct Published<Value> {
    public var wrappedValue: Value
    public init(wrappedValue: Value) { self.wrappedValue = wrappedValue }
}
SWIFT
for source in Auth/AuthCoordinator.swift Auth/TokenStoreProtocol.swift Networking/APIClientProtocol.swift Networking/APIError.swift Models/Session.swift Models/Feed.swift Models/PostDraft.swift Localization/ErrorMessages.swift; do
    cp "$repo_dir/ios/SN/$source" "$check_dir/Sources/SN/"
done
cp "$repo_dir/ios/SNTests/"*.swift "$check_dir/Tests/SNTests/"
swift test --package-path "$check_dir" --disable-sandbox
