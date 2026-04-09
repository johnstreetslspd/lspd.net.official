import SwiftUI

// MARK: - Admin-Panel
struct AdminView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("Bereich", selection: $selectedTab) {
                Text("Rollen").tag(0)
                Text("Abteilungen").tag(1)
                Text("System").tag(2)
            }
            .pickerStyle(.segmented)
            .padding()

            switch selectedTab {
            case 0: AdminRolesView()
            case 1: AdminDepartmentsView()
            case 2: AdminSystemView()
            default: EmptyView()
            }
        }
        .navigationTitle("Administration")
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Rollen-Verwaltung
struct AdminRolesView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var showAddRole = false
    @State private var selectedRole: LSPDRole?

    var body: some View {
        List {
            ForEach(dbService.roles.sorted(by: { $0.priority > $1.priority })) { role in
                Button { selectedRole = role } label: {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color(hex: role.color))
                            .frame(width: 12, height: 12)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(role.name).font(.headline)
                                if role.isDefault {
                                    Text("Standard").font(.caption2)
                                        .padding(.horizontal, 6).padding(.vertical, 2)
                                        .background(Color(.systemGray4))
                                        .clipShape(Capsule())
                                }
                            }
                            Text("Priorität: \(role.priority) • \(role.permissions.count) Berechtigungen")
                                .font(.caption).foregroundStyle(.secondary)
                            Text(role.description).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                let sorted = dbService.roles.sorted(by: { $0.priority > $1.priority })
                let idsToDelete = indexSet.map { sorted[$0].id }
                for id in idsToDelete {
                    Task { await dbService.deleteRole(id) }
                }
            }
        }
        .listStyle(.plain)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddRole = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAddRole) { AddRoleView() }
        .sheet(item: $selectedRole) { role in EditRoleView(role: role) }
    }
}

// MARK: - Rolle hinzufügen
struct AddRoleView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var priority = 20
    @State private var selectedPermissions: Set<String> = []

    var body: some View {
        NavigationStack {
            Form {
                Section("Grunddaten") {
                    TextField("Rollenname", text: $name)
                    TextField("Beschreibung", text: $description)
                    Stepper("Priorität: \(priority)", value: $priority, in: 0...100)
                }
                Section("Berechtigungen") {
                    ForEach(allFeatures, id: \.self) { feature in
                        Toggle(feature.capitalized, isOn: Binding(
                            get: { selectedPermissions.contains(feature) },
                            set: { if $0 { selectedPermissions.insert(feature) } else { selectedPermissions.remove(feature) } }
                        ))
                    }
                }
            }
            .navigationTitle("Neue Rolle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let role = LSPDRole(
                            id: "role_custom_\(UUID().uuidString)",
                            name: name, color: "#888888", icon: "fas fa-user-tag",
                            priority: priority, description: description,
                            isDefault: false, permissions: Array(selectedPermissions)
                        )
                        Task {
                            await dbService.addRole(role)
                            dismiss()
                        }
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }
}

// MARK: - Rolle bearbeiten
struct EditRoleView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    let role: LSPDRole
    @State private var name = ""
    @State private var description = ""
    @State private var priority = 0
    @State private var selectedPermissions: Set<String> = []

    var body: some View {
        NavigationStack {
            Form {
                Section("Grunddaten") {
                    TextField("Rollenname", text: $name)
                    TextField("Beschreibung", text: $description)
                    Stepper("Priorität: \(priority)", value: $priority, in: 0...100)
                }
                Section("Berechtigungen") {
                    ForEach(allFeatures, id: \.self) { feature in
                        Toggle(feature.capitalized, isOn: Binding(
                            get: { selectedPermissions.contains(feature) },
                            set: { if $0 { selectedPermissions.insert(feature) } else { selectedPermissions.remove(feature) } }
                        ))
                    }
                }
            }
            .onAppear {
                name = role.name
                description = role.description
                priority = role.priority
                selectedPermissions = Set(role.permissions)
            }
            .navigationTitle("Rolle bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        var updated = role
                        updated.name = name
                        updated.description = description
                        updated.priority = priority
                        updated.permissions = Array(selectedPermissions)
                        Task {
                            await dbService.updateRole(updated)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Abteilungen-Verwaltung
struct AdminDepartmentsView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var showAddDept = false
    @State private var selectedDept: LSPDDepartment?

    var body: some View {
        List {
            ForEach(dbService.departments) { dept in
                Button { selectedDept = dept } label: {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color(hex: dept.color))
                            .frame(width: 12, height: 12)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dept.name).font(.headline)
                            Text(dept.description).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                let idsToDelete = indexSet.map { dbService.departments[$0].id }
                for id in idsToDelete {
                    Task { await dbService.deleteDepartment(id) }
                }
            }
        }
        .listStyle(.plain)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddDept = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAddDept) { AddDepartmentView() }
        .sheet(item: $selectedDept) { dept in EditDepartmentView(department: dept) }
    }
}

// MARK: - Abteilung hinzufügen
struct AddDepartmentView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var description = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Beschreibung", text: $description)
            }
            .navigationTitle("Neue Abteilung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let dept = LSPDDepartment(
                            id: "dept_\(UUID().uuidString)",
                            name: name, color: "#888888",
                            icon: "fas fa-building", description: description
                        )
                        Task {
                            await dbService.addDepartment(dept)
                            dismiss()
                        }
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }
}

// MARK: - Abteilung bearbeiten
struct EditDepartmentView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    let department: LSPDDepartment
    @State private var name = ""
    @State private var description = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Beschreibung", text: $description)
            }
            .onAppear {
                name = department.name
                description = department.description
            }
            .navigationTitle("Abteilung bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        var updated = department
                        updated.name = name
                        updated.description = description
                        Task {
                            await dbService.updateDepartment(updated)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}

// MARK: - System-Informationen
struct AdminSystemView: View {
    @EnvironmentObject var dbService: DatabaseService

    var body: some View {
        List {
            Section("Firebase") {
                LabeledContent("Status", value: dbService.isConnected ? "✅ Verbunden" : "❌ Offline")
                if let error = dbService.lastError {
                    LabeledContent("Letzter Fehler", value: error)
                }
            }

            Section("Datenbank-Statistik") {
                LabeledContent("Nutzer", value: "\(dbService.users.count)")
                LabeledContent("Ränge", value: "\(dbService.jobRanks.count)")
                LabeledContent("Rollen", value: "\(dbService.roles.count)")
                LabeledContent("Abteilungen", value: "\(dbService.departments.count)")
                LabeledContent("Bürger", value: "\(dbService.citizens.count)")
                LabeledContent("Beweise", value: "\(dbService.evidence.count)")
                LabeledContent("Schulungen", value: "\(dbService.training.count)")
                LabeledContent("Bewerbungen", value: "\(dbService.applications.count)")
                LabeledContent("Strafakten", value: "\(dbService.citations.count)")
                LabeledContent("Anzeigen", value: "\(dbService.charges.count)")
                LabeledContent("Presse", value: "\(dbService.press.count)")
                LabeledContent("Anfragen", value: "\(dbService.requests.count)")
                LabeledContent("News", value: "\(dbService.news.count)")
            }

            Section("App-Info") {
                LabeledContent("Version", value: "1.0.0")
                LabeledContent("Plattform", value: "iOS (SwiftUI)")
                LabeledContent("Backend", value: "Firebase Firestore")
            }
        }
        .listStyle(.insetGrouped)
    }
}
