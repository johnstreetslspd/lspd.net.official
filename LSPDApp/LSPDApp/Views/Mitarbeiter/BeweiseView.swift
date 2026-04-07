import SwiftUI

// MARK: - Beweismittel-Verwaltung
struct BeweiseView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var searchText = ""
    @State private var showAddEvidence = false
    @State private var selectedEvidence: LSPDEvidence?

    var filteredEvidence: [LSPDEvidence] {
        if searchText.isEmpty { return dbService.evidence }
        return dbService.evidence.filter {
            $0.title.localizedCaseInsensitiveContains(searchText) ||
            $0.description.localizedCaseInsensitiveContains(searchText) ||
            ($0.caseNumber ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        List {
            SearchBar(text: $searchText, placeholder: "Beweise suchen...")
                .listRowBackground(Color.clear)

            if filteredEvidence.isEmpty {
                EmptyStateView(icon: "magnifyingglass", title: "Keine Beweise",
                               subtitle: "Noch keine Beweismittel erfasst")
                    .listRowBackground(Color.clear)
            }

            ForEach(filteredEvidence) { item in
                Button { selectedEvidence = item } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title).font(.headline)
                        Text(item.description).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                        HStack {
                            if let type = item.type {
                                Text(type).font(.caption).foregroundStyle(LSPDColors.info)
                            }
                            if let caseNum = item.caseNumber {
                                Text("Fall: \(caseNum)").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let date = item.date {
                                Text(formatISODate(date, dateStyle: .short, timeStyle: .none))
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                for idx in indexSet {
                    let item = filteredEvidence[idx]
                    Task { await dbService.deleteEvidence(item.id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Beweise (\(dbService.evidence.count))")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddEvidence = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAddEvidence) { AddEvidenceView() }
        .sheet(item: $selectedEvidence) { item in EvidenceDetailView(evidence: item) }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Beweis hinzufügen
struct AddEvidenceView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var type = ""
    @State private var caseNumber = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Beweis-Daten") {
                    TextField("Titel", text: $title)
                    TextEditor(text: $description)
                        .frame(minHeight: 80)
                }
                Section("Zuordnung") {
                    TextField("Typ (z.B. Foto, Dokument)", text: $type)
                    TextField("Fallnummer", text: $caseNumber)
                }
            }
            .navigationTitle("Neuer Beweis")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let item = LSPDEvidence(id: 0, title: title, description: description,
                                                type: type.isEmpty ? nil : type,
                                                caseNumber: caseNumber.isEmpty ? nil : caseNumber,
                                                addedBy: authVM.currentUser?.username,
                                                date: ISO8601DateFormatter().string(from: Date()))
                        Task {
                            await dbService.addEvidence(item)
                            dismiss()
                        }
                    }
                    .disabled(title.isEmpty)
                }
            }
        }
    }
}

// MARK: - Beweis-Detail
struct EvidenceDetailView: View {
    @Environment(\.dismiss) var dismiss
    let evidence: LSPDEvidence

    var body: some View {
        NavigationStack {
            List {
                Section("Details") {
                    LabeledContent("Titel", value: evidence.title)
                    if !evidence.description.isEmpty {
                        Text(evidence.description)
                    }
                }
                Section("Metadaten") {
                    if let type = evidence.type { LabeledContent("Typ", value: type) }
                    if let caseNum = evidence.caseNumber { LabeledContent("Fallnummer", value: caseNum) }
                    if let addedBy = evidence.addedBy { LabeledContent("Erfasst von", value: addedBy) }
                    if let date = evidence.date { LabeledContent("Datum", value: formatISODate(date)) }
                }
            }
            .navigationTitle("Beweis")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } }
            }
        }
    }
}
