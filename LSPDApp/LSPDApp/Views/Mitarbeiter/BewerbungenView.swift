import SwiftUI

// MARK: - Bewerbungen-Verwaltung
struct BewerbungenView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var searchText = ""
    @State private var filterStatus = "Alle"
    @State private var selectedApp: LSPDApplication?

    let statusOptions = ["Alle", "Offen", "Angenommen", "Abgelehnt"]

    var filteredApps: [LSPDApplication] {
        var result = dbService.applications
        if filterStatus != "Alle" {
            result = result.filter { $0.status == filterStatus }
        }
        if !searchText.isEmpty {
            result = result.filter {
                $0.applicantName.localizedCaseInsensitiveContains(searchText) ||
                ($0.trackingCode ?? "").localizedCaseInsensitiveContains(searchText)
            }
        }
        return result
    }

    var body: some View {
        List {
            SearchBar(text: $searchText, placeholder: "Bewerbung suchen...")
                .listRowBackground(Color.clear)

            Picker("Status", selection: $filterStatus) {
                ForEach(statusOptions, id: \.self) { Text($0) }
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)

            if filteredApps.isEmpty {
                EmptyStateView(icon: "doc.text", title: "Keine Bewerbungen",
                               subtitle: "Keine Bewerbungen gefunden")
                    .listRowBackground(Color.clear)
            }

            ForEach(filteredApps) { app in
                Button { selectedApp = app } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(app.applicantName).font(.headline)
                            Spacer()
                            StatusBadge(status: app.status)
                        }
                        HStack {
                            if let email = app.email {
                                Label(email, systemImage: "envelope").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let date = app.date {
                                Text(formatISODate(date, dateStyle: .short, timeStyle: .none))
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        if let code = app.trackingCode {
                            Text("Code: \(code)").font(.caption.monospaced()).foregroundStyle(LSPDColors.info)
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                for idx in indexSet {
                    Task { await dbService.deleteApplication(filteredApps[idx].id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Bewerbungen (\(dbService.applications.count))")
        .sheet(item: $selectedApp) { app in ApplicationDetailView(application: app) }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Bewerbungs-Detail
struct ApplicationDetailView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) var dismiss
    let application: LSPDApplication
    @State private var status: String = ""
    @State private var reviewNotes: String = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Bewerber") {
                    LabeledContent("Name", value: application.applicantName)
                    if let email = application.email { LabeledContent("E-Mail", value: email) }
                    if let phone = application.phone { LabeledContent("Telefon", value: phone) }
                    if let age = application.age { LabeledContent("Alter", value: age) }
                    if let code = application.trackingCode { LabeledContent("Tracking-Code", value: code) }
                }

                if let motivation = application.motivation, !motivation.isEmpty {
                    Section("Motivation") { Text(motivation) }
                }
                if let experience = application.experience, !experience.isEmpty {
                    Section("Erfahrung") { Text(experience) }
                }

                Section("Bearbeitung") {
                    Picker("Status", selection: $status) {
                        Text("Offen").tag("Offen")
                        Text("Angenommen").tag("Angenommen")
                        Text("Abgelehnt").tag("Abgelehnt")
                    }
                    TextEditor(text: $reviewNotes)
                        .frame(minHeight: 60)
                }

                if let date = application.date {
                    Section("Datum") {
                        LabeledContent("Eingegangen", value: formatISODate(date))
                    }
                }
            }
            .onAppear {
                status = application.status
                reviewNotes = application.reviewNotes ?? ""
            }
            .navigationTitle("Bewerbung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        var updated = application
                        updated.status = status
                        updated.reviewNotes = reviewNotes
                        updated.reviewedBy = authVM.currentUser?.username
                        Task {
                            await dbService.updateApplication(updated)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}
