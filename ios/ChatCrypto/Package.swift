// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SNChatCrypto",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [
        .library(name: "SNChatCrypto", targets: ["SNChatCrypto"]),
        .executable(name: "SNChatInterop", targets: ["SNChatInterop"]),
    ],
    dependencies: [.package(url: "https://github.com/apple/swift-crypto.git", exact: "4.0.0")],
    targets: [
        .target(name: "SNChatCrypto", dependencies: [
            .product(name: "Crypto", package: "swift-crypto", condition: .when(platforms: [.linux]))
        ]),
        .executableTarget(name: "SNChatInterop", dependencies: ["SNChatCrypto"]),
        .testTarget(name: "SNChatCryptoTests", dependencies: ["SNChatCrypto"]),
    ]
)
