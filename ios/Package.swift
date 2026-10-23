// swift-tools-version: 6.0
// Package SwiftPM dell'app iOS "SN", costruita con xtool su Linux + Darwin SDK.
// xtool richiede esattamente un prodotto di tipo library che rappresenta l'app.
import PackageDescription

let package = Package(
    name: "SN",
    platforms: [
        .iOS(.v17),
    ],
    products: [
        .library(
            name: "SN",
            targets: ["SN"]
        ),
    ],
    dependencies: [.package(path: "ChatCrypto")],
    targets: [
        .target(
            name: "SN",
            dependencies: [.product(name: "SNChatCrypto", package: "ChatCrypto")],
            path: "SN",
            // Info.plist non è un sorgente: viene usato da xtool tramite `infoPath`.
            exclude: ["Info.plist"]
        ),
        .testTarget(
            name: "SNTests",
            dependencies: ["SN"],
            path: "SNTests"
        ),
    ]
)
