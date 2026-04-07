// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LSPDApp",
    platforms: [
        .iOS(.v17)
    ],
    dependencies: [
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "10.20.0")
    ],
    targets: [
        .executableTarget(
            name: "LSPDApp",
            dependencies: [
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
            ],
            path: "LSPDApp"
        )
    ]
)
