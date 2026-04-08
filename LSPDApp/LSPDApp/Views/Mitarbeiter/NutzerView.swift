import SwiftUI

// MARK: - Nutzerverwaltung
struct NutzerView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @State private var searchText = ""
    @State private var showAddUser = false
    @State private var selectedUser: LSPDUser?
    @State private var toastMessage: String?

    var filteredUsers: [LSPDUser] {
        if searchText.isEmpty { return dbService.users }
        return dbService.users.filter {
            $0.username.localizedCaseInsensitiveContains(searchText) ||
            $0.role.localizedCaseInsensitiveContains(searchText) ||
            $0.jobRank.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        List {
            SearchBar(text: $searchText, placeholder: "Nutzer suchen...")
                .listRowBackground(Color.clear)

            ForEach(filteredUsers) { user in
                Button {
                    selectedUser = user
                } label: {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .font(.title2)
                            .foregroundStyle(Color(hex: dbService.roles.first(where: { $0.name == user.role })?.color ?? "#0066cc"))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.username).font(.headline)
                            HStack {
                                Text(user.role).font(.caption).foregroundStyle(.secondary)
                                Text("•").foregroundStyle(.secondary)
                                Text(user.jobRank).font(.caption).foregroundStyle(LSPDColors.secondary)
                            }
                        }
                        Spacer()
                        StatusBadge(status: user.status)
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                for idx in indexSet {
                    let user = filteredUsers[idx]
                    Task { await dbService.deleteUser(user.id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Nutzer (\(dbService.users.count))")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddUser = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddUser) {
            AddUserView()
        }
        .sheet(item: $selectedUser) { user in
            EditUserView(user: user)
        }
        .toast(message: $toastMessage)
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Nutzer hinzufügen
struct AddUserView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    @State private var username = ""
    @State private var password = ""
    @State private var selectedRole = "Mitarbeiter"
    @State private var selectedRank = "Officer"

    var body: some View {
        NavigationStack {
            Form {
                Section("Zugangsdaten") {
                    TextField("Benutzername", text: $username)
                        .textInputAutocapitalization(.never)
                    SecureField("Passwort", text: $password)
                }
                Section("Zuordnung") {
                    Picker("Rolle", selection: $selectedRole) {
                        ForEach(dbService.roles.sorted(by: { $0.priority > $1.priority }), id: \.name) { role in
                            Text(role.name).tag(role.name)
                        }
                    }
                    Picker("Rang", selection: $selectedRank) {
                        ForEach(dbService.jobRanks.sorted(by: { $0.priority > $1.priority }), id: \.name) { rank in
                            Text(rank.name).tag(rank.name)
                        }
                    }
                }
            }
            .navigationTitle("Neuer Nutzer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let user = LSPDUser(id: 0, username: username, password: password,
                                            role: selectedRole, jobRank: selectedRank,
                                            status: "Aktiv", created: ISO8601DateFormatter().string(from: Date()))
                        Task {
                            await dbService.addUser(user)
                            dismiss()
                        }
                    }
                    .disabled(username.isEmpty || password.isEmpty)
                }
            }
        }
    }
}

// MARK: - Nutzer bearbeiten
struct EditUserView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    let user: LSPDUser
    @State private var username: String = ""
    @State private var role: String = ""
    @State private var jobRank: String = ""
    @State private var status: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Benutzerdaten") {
                    TextField("Benutzername", text: $username)
                        .textInputAutocapitalization(.never)
                }
                Section("Zuordnung") {
                    Picker("Rolle", selection: $role) {
                        ForEach(dbService.roles.sorted(by: { $0.priority > $1.priority }), id: \.name) { r in
                            Text(r.name).tag(r.name)
                        }
                    }
                    Picker("Rang", selection: $jobRank) {
                        ForEach(dbService.jobRanks.sorted(by: { $0.priority > $1.priority }), id: \.name) { r in
                            Text(r.name).tag(r.name)
                        }
                    }
                }
                Section("Status") {
                    Picker("Status", selection: $status) {
                        Text("Aktiv").tag("Aktiv")
                        Text("Gesperrt").tag("Gesperrt")
                    }
                }
            }
            .onAppear {
                username = user.username
                role = user.role
                jobRank = user.jobRank
                status = user.status
            }
            .navigationTitle("Nutzer bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        var updated = user
                        updated.username = username
                        updated.role = role
                        updated.jobRank = jobRank
                        updated.status = status
                        Task {
                            await dbService.updateUser(updated)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}
