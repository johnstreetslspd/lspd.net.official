import Foundation
import SwiftUI

// MARK: - AuthViewModel – Authentifizierung
@MainActor
class AuthViewModel: ObservableObject {
    @Published var currentUser: LSPDUser?
    @Published var isLoggedIn = false
    @Published var loginError: String?
    @Published var stayLoggedIn = false

    private let sessionKey = "lspd_session"

    init() {
        tryAutoLogin()
    }

    // MARK: - Login
    func login(username: String, password: String, stayLoggedIn: Bool = false) {
        let db = DatabaseService.shared

        guard let user = db.users.first(where: {
            $0.username.lowercased() == username.lowercased() && $0.password == password
        }) else {
            loginError = "Ungültiger Benutzername oder Passwort"
            return
        }

        guard user.status == "Aktiv" else {
            loginError = "Konto ist deaktiviert"
            return
        }

        currentUser = user
        isLoggedIn = true
        loginError = nil
        self.stayLoggedIn = stayLoggedIn

        if stayLoggedIn {
            saveSession(user)
        }
    }

    // MARK: - Logout
    func logout() {
        currentUser = nil
        isLoggedIn = false
        clearSession()
        DatabaseService.shared.stopListening()
    }

    // MARK: - Session speichern
    private func saveSession(_ user: LSPDUser) {
        let session: [String: Any] = [
            "username": user.username,
            "role": user.role,
            "stayLoggedIn": true,
            "expires": Date().addingTimeInterval(7 * 24 * 60 * 60).timeIntervalSince1970
        ]
        if let data = try? JSONSerialization.data(withJSONObject: session) {
            UserDefaults.standard.set(data, forKey: sessionKey)
        }
    }

    // MARK: - Session löschen
    private func clearSession() {
        UserDefaults.standard.removeObject(forKey: sessionKey)
    }

    // MARK: - Auto-Login
    func tryAutoLogin() {
        guard let data = UserDefaults.standard.data(forKey: sessionKey),
              let session = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let username = session["username"] as? String,
              let expires = session["expires"] as? Double,
              Date().timeIntervalSince1970 < expires else {
            return
        }

        let db = DatabaseService.shared
        if let user = db.users.first(where: { $0.username == username }) {
            currentUser = user
            isLoggedIn = true
            stayLoggedIn = true
        } else {
            // Daten sind noch nicht geladen – auf Änderungen warten
            pendingAutoLoginUsername = username
        }
    }

    /// Wird aufgerufen, wenn Firestore-Daten geladen wurden
    func retryAutoLoginIfNeeded() {
        guard let username = pendingAutoLoginUsername else { return }
        pendingAutoLoginUsername = nil

        // Session nochmals prüfen
        guard let data = UserDefaults.standard.data(forKey: sessionKey),
              let session = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let expires = session["expires"] as? Double,
              Date().timeIntervalSince1970 < expires else {
            return
        }

        let db = DatabaseService.shared
        if let user = db.users.first(where: { $0.username == username }) {
            currentUser = user
            isLoggedIn = true
            stayLoggedIn = true
        }
    }

    private var pendingAutoLoginUsername: String?

    // MARK: - Berechtigungen prüfen
    func hasPermission(_ permission: String) -> Bool {
        DatabaseService.shared.hasPermission(currentUser, permission)
    }
}
