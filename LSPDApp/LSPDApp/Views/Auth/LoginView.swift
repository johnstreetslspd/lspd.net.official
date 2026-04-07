import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss

    @State private var username = ""
    @State private var password = ""
    @State private var stayLoggedIn = false
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                // Logo
                VStack(spacing: 8) {
                    Image(systemName: "shield.checkered")
                        .font(.system(size: 60))
                        .foregroundStyle(LSPDColors.primary)
                    Text("LSPD")
                        .font(.system(size: 32, weight: .black))
                        .foregroundStyle(LSPDColors.secondary)
                    Text("Mitarbeiterportal")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                // Fehler
                if let error = authVM.loginError {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.white)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.red.opacity(0.8))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                // Formular
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Benutzername")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        TextField("Benutzername", text: $username)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(Color(.systemGray6).opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Passwort")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        SecureField("Passwort", text: $password)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(Color(.systemGray6).opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    Toggle("Angemeldet bleiben", isOn: $stayLoggedIn)
                        .font(.subheadline)
                        .tint(LSPDColors.primary)

                    Button {
                        isLoading = true
                        // Warte kurz auf Firebase
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            authVM.login(username: username, password: password, stayLoggedIn: stayLoggedIn)
                            isLoading = false
                            if authVM.isLoggedIn {
                                dismiss()
                            }
                        }
                    } label: {
                        HStack {
                            if isLoading {
                                ProgressView()
                                    .tint(.white)
                            }
                            Text("Anmelden")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(LSPDColors.primary)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(username.isEmpty || password.isEmpty || isLoading)
                }
                .padding()

                Spacer()

                // Firebase Status
                HStack {
                    Circle()
                        .fill(dbService.isConnected ? Color.green : Color.red)
                        .frame(width: 8, height: 8)
                    Text(dbService.isConnected ? "Firebase verbunden" : "Verbindung wird hergestellt...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom)
            }
            .padding()
            .background(LSPDColors.dark.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
    }
}
