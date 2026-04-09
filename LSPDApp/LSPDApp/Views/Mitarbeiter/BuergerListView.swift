import SwiftUI

// MARK: - Bürger-Liste (Mitarbeiter-Ansicht)
struct BuergerListView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var searchText = ""
    @State private var showAddCitizen = false
    @State private var selectedCitizen: LSPDCitizen?

    var filteredCitizens: [LSPDCitizen] {
        if searchText.isEmpty { return dbService.citizens }
        return dbService.citizens.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.pkz.localizedCaseInsensitiveContains(searchText) ||
            ($0.address ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        List {
            SearchBar(text: $searchText, placeholder: "Bürger suchen (Name, PKZ)...")
                .listRowBackground(Color.clear)

            ForEach(filteredCitizens) { citizen in
                Button {
                    selectedCitizen = citizen
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(citizen.name).font(.headline)
                            HStack {
                                Text(citizen.pkz)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(LSPDColors.info)
                                if let dob = citizen.dateOfBirth, !dob.isEmpty {
                                    Text("• \(dob)").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            if let address = citizen.address, !address.isEmpty {
                                Text(address).font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if let wanted = citizen.wantedLevel, wanted > 0 {
                            HStack(spacing: 2) {
                                ForEach(0..<min(wanted, 5), id: \.self) { _ in
                                    Image(systemName: "star.fill")
                                        .font(.caption2)
                                        .foregroundStyle(.red)
                                }
                            }
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                let idsToDelete = indexSet.map { filteredCitizens[$0].id }
                for id in idsToDelete {
                    Task { await dbService.deleteCitizen(id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Bürger (\(dbService.citizens.count))")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddCitizen = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAddCitizen) { AddCitizenView() }
        .sheet(item: $selectedCitizen) { citizen in CitizenDetailView(citizen: citizen) }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Bürger hinzufügen
struct AddCitizenView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var dateOfBirth = ""
    @State private var address = ""
    @State private var phone = ""
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Persönliche Daten") {
                    TextField("Name", text: $name)
                    TextField("Geburtsdatum", text: $dateOfBirth)
                    TextField("Adresse", text: $address)
                    TextField("Telefon", text: $phone)
                }
                Section("Notizen") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Neuer Bürger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let citizen = LSPDCitizen(id: 0, name: name, pkz: "",
                                                   dateOfBirth: dateOfBirth.isEmpty ? nil : dateOfBirth,
                                                   address: address.isEmpty ? nil : address,
                                                   phone: phone.isEmpty ? nil : phone,
                                                   notes: notes.isEmpty ? nil : notes,
                                                   wantedLevel: 0,
                                                   created: ISO8601DateFormatter().string(from: Date()))
                        Task {
                            await dbService.addCitizen(citizen)
                            dismiss()
                        }
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }
}

// MARK: - Bürger-Detailansicht
struct CitizenDetailView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
    let citizen: LSPDCitizen
    @State private var name: String = ""
    @State private var dateOfBirth: String = ""
    @State private var address: String = ""
    @State private var phone: String = ""
    @State private var notes: String = ""
    @State private var wantedLevel: Int = 0

    var citizenCitations: [LSPDCitation] {
        dbService.citations.filter { $0.citizenId == citizen.id || ($0.citizenId == nil && $0.name == citizen.name) }
    }

    var citizenCharges: [LSPDCharge] {
        dbService.charges.filter { $0.citizenId == citizen.id || ($0.citizenId == nil && $0.name == citizen.name) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Persönliche Daten") {
                    TextField("Name", text: $name)
                    LabeledContent("PKZ", value: citizen.pkz)
                    TextField("Geburtsdatum", text: $dateOfBirth)
                    TextField("Adresse", text: $address)
                    TextField("Telefon", text: $phone)
                    Stepper("Fahndungsstufe: \(wantedLevel)", value: $wantedLevel, in: 0...5)
                }

                Section("Notizen") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 60)
                }

                if !citizenCitations.isEmpty {
                    Section("Strafakten (\(citizenCitations.count))") {
                        ForEach(citizenCitations) { cit in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(cit.type).font(.subheadline.bold())
                                HStack {
                                    if let az = cit.aktenzeichen { Text(az).font(.caption.monospaced()).foregroundStyle(LSPDColors.info) }
                                    if let date = cit.date { Text(formatISODate(date)).font(.caption).foregroundStyle(.secondary) }
                                }
                            }
                        }
                    }
                }

                if !citizenCharges.isEmpty {
                    Section("Anzeigen (\(citizenCharges.count))") {
                        ForEach(citizenCharges) { charge in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(charge.type).font(.subheadline.bold())
                                if let az = charge.chargeNumber {
                                    Text(az).font(.caption.monospaced()).foregroundStyle(LSPDColors.info)
                                }
                            }
                        }
                    }
                }
            }
            .onAppear {
                name = citizen.name
                dateOfBirth = citizen.dateOfBirth ?? ""
                address = citizen.address ?? ""
                phone = citizen.phone ?? ""
                notes = citizen.notes ?? ""
                wantedLevel = citizen.wantedLevel ?? 0
            }
            .navigationTitle("Bürger-Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        var updated = citizen
                        updated.name = name
                        updated.dateOfBirth = dateOfBirth.isEmpty ? nil : dateOfBirth
                        updated.address = address.isEmpty ? nil : address
                        updated.phone = phone.isEmpty ? nil : phone
                        updated.notes = notes.isEmpty ? nil : notes
                        updated.wantedLevel = wantedLevel
                        Task {
                            await dbService.updateCitizen(updated)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}
