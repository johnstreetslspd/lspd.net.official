// swift-tools-version: 5.9
import PackageDescription

// HINWEIS: Dieses Package.swift dient nur als Referenz für die Firebase-Abhängigkeiten.
// Zum Bauen und Starten der App bitte LSPDApp.xcodeproj in Xcode öffnen!
let package = Package(
    name: "LSPDApp",
    platforms: [
        .iOS(.v17)
    ],
    dependencies: [
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "10.20.0")
    ],
    targets: [
        .target(
            name: "LSPDApp",
            dependencies: [
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
            ],
            path: "LSPDApp"
        )
    ]
)
