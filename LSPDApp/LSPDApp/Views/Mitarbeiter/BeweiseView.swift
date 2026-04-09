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
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            ($0.description ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.aktenzeichen ?? "").localizedCaseInsensitiveContains(searchText)
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
                        Text(item.name).font(.headline)
                        if let desc = item.description {
                            Text(desc).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                        }
                        HStack {
                            if let type = item.type {
                                Text(type).font(.caption).foregroundStyle(LSPDColors.info)
                            }
                            if let az = item.aktenzeichen {
                                Text(az).font(.caption.monospaced()).foregroundStyle(.secondary)
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
                let idsToDelete = indexSet.map { filteredEvidence[$0].id }
                for id in idsToDelete {
                    Task { await dbService.deleteEvidence(id) }
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
    @State private var name = ""
    @State private var description = ""
    @State private var type = ""
    @State private var location = ""
    @State private var citationAZ = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Beweis-Daten") {
                    TextField("Bezeichnung", text: $name)
                    TextEditor(text: $description)
                        .frame(minHeight: 80)
                }
                Section("Zuordnung") {
                    TextField("Typ (z.B. Foto, Dokument)", text: $type)
                    TextField("Fundort", text: $location)
                    TextField("Aktenzeichen Strafakte (CA-...)", text: $citationAZ)
                }
            }
            .navigationTitle("Neuer Beweis")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let item = LSPDEvidence(
                            id: 0,
                            aktenzeichen: nil,
                            name: name,
                            description: description.isEmpty ? nil : description,
                            type: type.isEmpty ? nil : type,
                            location: location.isEmpty ? nil : location,
                            citationAZ: citationAZ.isEmpty ? nil : citationAZ,
                            addedBy: authVM.currentUser?.username,
                            date: ISO8601DateFormatter().string(from: Date())
                        )
                        Task {
                            await dbService.addEvidence(item)
                            dismiss()
                        }
                    }
                    .disabled(name.isEmpty)
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
                    LabeledContent("Bezeichnung", value: evidence.name)
                    if let desc = evidence.description, !desc.isEmpty {
                        Text(desc)
                    }
                }
                Section("Metadaten") {
                    if let type = evidence.type { LabeledContent("Typ", value: type) }
                    if let az = evidence.aktenzeichen { LabeledContent("Beweismittel-Nr.", value: az) }
                    if let loc = evidence.location { LabeledContent("Fundort", value: loc) }
                    if let citAZ = evidence.citationAZ { LabeledContent("Aktenzeichen", value: citAZ) }
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
