import SwiftUI

// MARK: - Anzeigen-Verwaltung
struct AnzeigenView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var searchText = ""
    @State private var showAddCharge = false
    @State private var selectedCharge: LSPDCharge?

    var filteredCharges: [LSPDCharge] {
        if searchText.isEmpty { return dbService.charges }
        return dbService.charges.filter {
            $0.type.localizedCaseInsensitiveContains(searchText) ||
            ($0.name ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.chargeNumber ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        List {
            SearchBar(text: $searchText, placeholder: "Anzeige suchen...")
                .listRowBackground(Color.clear)

            if filteredCharges.isEmpty {
                EmptyStateView(icon: "exclamationmark.triangle", title: "Keine Anzeigen",
                               subtitle: "Noch keine Anzeigen vorhanden")
                    .listRowBackground(Color.clear)
            }

            ForEach(filteredCharges) { charge in
                Button { selectedCharge = charge } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(charge.type).font(.headline)
                            Spacer()
                            if let status = charge.status { StatusBadge(status: status) }
                        }
                        HStack {
                            if let name = charge.name {
                                Label(name, systemImage: "person").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let az = charge.chargeNumber {
                                Text(az).font(.caption.monospaced()).foregroundStyle(LSPDColors.info)
                            }
                        }
                        HStack {
                            if let officer = charge.officer {
                                Text("Beamter: \(officer)").font(.caption2).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let date = charge.date {
                                Text(formatISODate(date, dateStyle: .short, timeStyle: .none))
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                let idsToDelete = indexSet.map { filteredCharges[$0].id }
                for id in idsToDelete {
                    Task { await dbService.deleteCharge(id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Anzeigen (\(dbService.charges.count))")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddCharge = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAddCharge) { AddChargeView() }
        .sheet(item: $selectedCharge) { charge in ChargeDetailView(charge: charge) }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Anzeige hinzufügen
struct AddChargeView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) var dismiss
    @State private var type = ""
    @State private var description = ""
    @State private var citizenSearch = ""
    @State private var selectedCitizen: LSPDCitizen?

    var citizenSuggestions: [LSPDCitizen] {
        if citizenSearch.isEmpty { return [] }
        return dbService.citizens.filter {
            $0.name.localizedCaseInsensitiveContains(citizenSearch)
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
                Section("Anzeige") {
                    TextField("Anklage / Typ", text: $type)
                    TextEditor(text: $description)
                        .frame(minHeight: 60)
                }
            }
            .navigationTitle("Neue Anzeige")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let item = LSPDCharge(
                            id: 0,
                            chargeNumber: nil,
                            aktenzeichen: nil,
                            name: selectedCitizen?.name,
                            citizenId: selectedCitizen?.id,
                            type: type,
                            vergehen: nil,
                            description: description.isEmpty ? nil : description,
                            officer: authVM.currentUser?.username,
                            source: "police",
                            status: "Aktiv",
                            date: ISO8601DateFormatter().string(from: Date())
                        )
                        Task {
                            await dbService.addCharge(item)
                            dismiss()
                        }
                    }
                    .disabled(type.isEmpty)
                }
            }
        }
    }
}

// MARK: - Anzeige-Detail
struct ChargeDetailView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    let charge: LSPDCharge
    @State private var status = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Anklage") {
                    LabeledContent("Anklage", value: charge.type)
                    if let desc = charge.description { Text(desc) }
                    if let az = charge.chargeNumber { LabeledContent("Anzeigen-Nr.", value: az) }
                    if let linked = charge.aktenzeichen { LabeledContent("Aktenzeichen", value: linked) }
                }
                Section("Zuordnung") {
                    if let name = charge.name { LabeledContent("Bürger", value: name) }
                    if let officer = charge.officer { LabeledContent("Beamter", value: officer) }
                    if let date = charge.date { LabeledContent("Datum", value: formatISODate(date)) }
                }
                Section("Status") {
                    Picker("Status", selection: $status) {
                        Text("Aktiv").tag("Aktiv")
                        Text("In Bearbeitung").tag("In Bearbeitung")
                        Text("Geschlossen").tag("Geschlossen")
                    }
                }
            }
            .onAppear { status = charge.status ?? "Aktiv" }
            .navigationTitle("Anzeige")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        var updated = charge
                        updated.status = status
                        Task {
                            await dbService.updateCharge(updated)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}
