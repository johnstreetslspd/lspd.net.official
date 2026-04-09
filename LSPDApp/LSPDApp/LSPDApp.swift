import SwiftUI
import FirebaseCore

// Firebase App Delegate für Initialisierung
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // Firebase programmatisch konfigurieren mit den Projekt-Werten
        guard FirebaseApp.app() == nil else {
            print("ℹ️ Firebase war bereits konfiguriert")
            return true
        }

        let options = FirebaseOptions(
            googleAppID: "1:213624245643:ios:a1b2c3d4e5f60001",
            gcmSenderID: "213624245643"
        )
        options.apiKey = "AIzaSyDAltEFoZPnXFyezoApgGf7FY7bAOFk5oA"
        options.projectID = "lspd-roleplay"
        options.storageBucket = "lspd-roleplay.firebasestorage.app"
        options.databaseURL = "https://lspd-roleplay.firebaseio.com"

        FirebaseApp.configure(options: options)
        print("✅ Firebase erfolgreich konfiguriert (Projekt: lspd-roleplay)")
        return true
    }
}

@main
struct LSPDApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var authVM = AuthViewModel()
    @StateObject private var dbService = DatabaseService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authVM)
                .environmentObject(dbService)
                .preferredColorScheme(.dark)
        }
    }
}
