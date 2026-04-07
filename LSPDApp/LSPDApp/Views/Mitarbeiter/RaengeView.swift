import SwiftUI

// MARK: - Ränge-Verwaltung
struct RaengeView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var showAddRank = false
    @State private var selectedRank: LSPDRank?

    var sortedRanks: [LSPDRank] {
        dbService.jobRanks.sorted(by: { $0.priority > $1.priority })
    }

    var body: some View {
        List {
            ForEach(sortedRanks) { rank in
                Button {
                    selectedRank = rank
                } label: {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color(hex: rank.color))
                            .frame(width: 10, height: 10)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(rank.name).font(.headline)
                                if !rank.abbreviation.isEmpty {
                                    Text("(\(rank.abbreviation))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            HStack {
                                Text("Priorität: \(rank.priority)").font(.caption).foregroundStyle(.secondary)
                                if !rank.department.isEmpty {
                                    Text("• \(rank.department)").font(.caption).foregroundStyle(LSPDColors.info)
                                }
                            }
                            if !rank.description.isEmpty {
                                Text(rank.description)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                for idx in indexSet {
                    let rank = sortedRanks[idx]
                    Task { await dbService.deleteRank(rank.id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Ränge (\(dbService.jobRanks.count))")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddRank = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddRank) {
            AddRankView()
        }
        .sheet(item: $selectedRank) { rank in
            EditRankView(rank: rank)
        }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Rang hinzufügen
struct AddRankView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var abbreviation = ""
    @State private var priority = 0
    @State private var color = "#00ff88"
    @State private var department = ""
    @State private var description = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Grunddaten") {
                    TextField("Name", text: $name)
                    TextField("Abkürzung", text: $abbreviation)
                    Stepper("Priorität: \(priority)", value: $priority, in: 0...100)
                }
                Section("Details") {
                    Picker("Abteilung", selection: $department) {
                        Text("Keine").tag("")
                        ForEach(dbService.departments, id: \.id) { dept in
                            Text(dept.name).tag(dept.name)
                        }
                    }
                    TextField("Beschreibung", text: $description)
                }
            }
            .navigationTitle("Neuer Rang")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let rank = LSPDRank(id: 0, name: name, color: color, icon: "fas fa-award",
                                            priority: priority, department: department,
                                            abbreviation: abbreviation, description: description)
                        Task {
                            await dbService.addRank(rank)
                            dismiss()
                        }
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }
}

// MARK: - Rang bearbeiten
struct EditRankView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    let rank: LSPDRank
    @State private var name = ""
    @State private var abbreviation = ""
    @State private var priority = 0
    @State private var department = ""
    @State private var description = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Grunddaten") {
                    TextField("Name", text: $name)
                    TextField("Abkürzung", text: $abbreviation)
                    Stepper("Priorität: \(priority)", value: $priority, in: 0...100)
                }
                Section("Details") {
                    Picker("Abteilung", selection: $department) {
                        Text("Keine").tag("")
                        ForEach(dbService.departments, id: \.id) { dept in
                            Text(dept.name).tag(dept.name)
                        }
                    }
                    TextField("Beschreibung", text: $description)
                }
            }
            .onAppear {
                name = rank.name
                abbreviation = rank.abbreviation
                priority = rank.priority
                department = rank.department
                description = rank.description
            }
            .navigationTitle("Rang bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        var updated = rank
                        updated.name = name
                        updated.abbreviation = abbreviation
                        updated.priority = priority
                        updated.department = department
                        updated.description = description
                        Task {
                            await dbService.updateRank(updated)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}
