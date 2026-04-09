import SwiftUI

// MARK: - Sonstiges / Anfragen
struct SonstigesView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var searchText = ""
    @State private var selectedRequest: LSPDRequest?

    var filteredRequests: [LSPDRequest] {
        if searchText.isEmpty { return dbService.requests }
        return dbService.requests.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.subject.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        List {
            SearchBar(text: $searchText, placeholder: "Anfrage suchen...")
                .listRowBackground(Color.clear)

            if filteredRequests.isEmpty {
                EmptyStateView(icon: "envelope", title: "Keine Anfragen",
                               subtitle: "Noch keine Anfragen eingegangen")
                    .listRowBackground(Color.clear)
            }

            ForEach(filteredRequests) { req in
                Button { selectedRequest = req } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(req.subject).font(.headline)
                            Spacer()
                            StatusBadge(status: req.status ?? "Offen")
                        }
                        HStack {
                            Label(req.name, systemImage: "person").font(.caption).foregroundStyle(.secondary)
                            if let type = req.type {
                                Text(type).font(.caption).foregroundStyle(LSPDColors.info)
                            }
                        }
                        Text(req.message).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        if let date = req.date {
                            Text(formatISODate(date, dateStyle: .short, timeStyle: .short))
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                let idsToDelete = indexSet.map { filteredRequests[$0].id }
                for id in idsToDelete {
                    Task { await dbService.deleteRequest(id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Anfragen (\(dbService.requests.count))")
        .sheet(item: $selectedRequest) { req in RequestDetailView(request: req) }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Anfrage-Detail
struct RequestDetailView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) var dismiss
    let request: LSPDRequest
    @State private var status = ""
    @State private var response = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Anfrage") {
                    LabeledContent("Name", value: request.name)
                    if let email = request.email { LabeledContent("E-Mail", value: email) }
                    LabeledContent("Betreff", value: request.subject)
                    if let type = request.type { LabeledContent("Typ", value: type) }
                    if let date = request.date { LabeledContent("Datum", value: formatISODate(date)) }
                }

                Section("Nachricht") {
                    Text(request.message)
                }

                Section("Antwort") {
                    Picker("Status", selection: $status) {
                        Text("Offen").tag("Offen")
                        Text("In Bearbeitung").tag("In Bearbeitung")
                        Text("Beantwortet").tag("Beantwortet")
                        Text("Geschlossen").tag("Geschlossen")
                    }
                    TextEditor(text: $response)
                        .frame(minHeight: 80)
                }
            }
            .onAppear {
                status = request.status ?? "Offen"
                response = request.response ?? ""
            }
            .navigationTitle("Anfrage")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        var updated = request
                        updated.status = status
                        updated.response = response.isEmpty ? nil : response
                        updated.respondedBy = authVM.currentUser?.username
                        Task {
                            await dbService.updateRequest(updated)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}
