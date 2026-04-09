import SwiftUI

// MARK: - Strafakten-Verwaltung
struct StrafaktenView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var searchText = ""
    @State private var showAddCitation = false
    @State private var selectedCitation: LSPDCitation?

    var filteredCitations: [LSPDCitation] {
        if searchText.isEmpty { return dbService.citations }
        return dbService.citations.filter {
            $0.type.localizedCaseInsensitiveContains(searchText) ||
            ($0.name ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.officer ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.aktenzeichen ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        List {
            SearchBar(text: $searchText, placeholder: "Strafakte suchen...")
                .listRowBackground(Color.clear)

            if filteredCitations.isEmpty {
                EmptyStateView(icon: "doc.badge.gearshape", title: "Keine Strafakten",
                               subtitle: "Noch keine Strafakten vorhanden")
                    .listRowBackground(Color.clear)
            }

            ForEach(filteredCitations) { cit in
                Button { selectedCitation = cit } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(cit.type).font(.headline)
                            Spacer()
                            if let status = cit.status {
                                StatusBadge(status: status)
                            }
                        }
                        HStack {
                            if let name = cit.name {
                                Label(name, systemImage: "person").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let az = cit.aktenzeichen {
                                Text(az).font(.caption.monospaced()).foregroundStyle(LSPDColors.info)
                            }
                        }
                        HStack {
                            if let officer = cit.officer {
                                Text("Beamter: \(officer)").font(.caption2).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let date = cit.date {
                                Text(formatISODate(date, dateStyle: .short, timeStyle: .none))
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                let idsToDelete = indexSet.map { filteredCitations[$0].id }
                for id in idsToDelete {
                    Task { await dbService.deleteCitation(id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Strafakten (\(dbService.citations.count))")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddCitation = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAddCitation) { AddCitationView() }
        .sheet(item: $selectedCitation) { cit in CitationDetailView(citation: cit) }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Strafakte hinzufügen
struct AddCitationView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) var dismiss
    @State private var type = ""
    @State private var description = ""
    @State private var selectedCitizen: LSPDCitizen?
    @State private var citizenSearch = ""

    var citizenSuggestions: [LSPDCitizen] {
        if citizenSearch.isEmpty { return [] }
        return dbService.citizens.filter {
            $0.name.localizedCaseInsensitiveContains(citizenSearch) ||
            $0.pkz.localizedCaseInsensitiveContains(citizenSearch)
        }.prefix(5).map { $0 }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Bürger zuordnen") {
                    TextField("Bürger suchen...", text: $citizenSearch)
                    if let citizen = selectedCitizen {
                        HStack {
                            Text("\(citizen.name) (\(citizen.pkz))")
                                .foregroundStyle(LSPDColors.secondary)
                            Spacer()
                            Button { selectedCitizen = nil; citizenSearch = "" } label: {
                                Image(systemName: "xmark.circle")
                            }
                        }
                    }
                    ForEach(citizenSuggestions) { citizen in
                        Button {
                            selectedCitizen = citizen
                            citizenSearch = citizen.name
                        } label: {
                            Text("\(citizen.name) – \(citizen.pkz)")
                        }
                    }
                }
                Section("Straftat") {
                    TextField("Vergehen / Typ", text: $type)
                    TextEditor(text: $description)
                        .frame(minHeight: 60)
                }
            }
            .navigationTitle("Neue Strafakte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let item = LSPDCitation(
                            id: 0,
                            aktenzeichen: nil,
                            name: selectedCitizen?.name,
                            citizenId: selectedCitizen?.id,
                            type: type,
                            status: "Offen",
                            description: description.isEmpty ? nil : description,
                            officer: authVM.currentUser?.username,
                            date: ISO8601DateFormatter().string(from: Date())
                        )
                        Task {
                            await dbService.addCitation(item)
                            dismiss()
                        }
                    }
                    .disabled(type.isEmpty)
                }
            }
        }
    }
}

// MARK: - Strafakte-Detail
struct CitationDetailView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    let citation: LSPDCitation
    @State private var status = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Vergehen") {
                    LabeledContent("Vergehen", value: citation.type)
                    if let desc = citation.description { Text(desc) }
                    if let az = citation.aktenzeichen {
                        LabeledContent("Aktenzeichen", value: az)
                    }
                }
                Section("Zuordnung") {
                    if let name = citation.name { LabeledContent("Bürger", value: name) }
                    if let officer = citation.officer { LabeledContent("Beamter", value: officer) }
                    if let date = citation.date { LabeledContent("Datum", value: formatISODate(date)) }
                }
                Section("Status") {
                    Picker("Status", selection: $status) {
                        Text("Offen").tag("Offen")
                        Text("Geschlossen").tag("Geschlossen")
                        Text("In Bearbeitung").tag("In Bearbeitung")
                    }
                }
            }
            .onAppear { status = citation.status ?? "Offen" }
            .navigationTitle("Strafakte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        var updated = citation
                        updated.status = status
                        Task {
                            await dbService.updateCitation(updated)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}
