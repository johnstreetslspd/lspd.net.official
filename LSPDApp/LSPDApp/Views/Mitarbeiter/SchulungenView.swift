import SwiftUI

// MARK: - Schulungen-Verwaltung
struct SchulungenView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @State private var showAddTraining = false
    @State private var selectedTraining: LSPDTraining?

    var body: some View {
        List {
            if dbService.training.isEmpty {
                EmptyStateView(icon: "book", title: "Keine Schulungen",
                               subtitle: "Noch keine Schulungen geplant")
                    .listRowBackground(Color.clear)
            }

            ForEach(dbService.training) { item in
                Button { selectedTraining = item } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.title).font(.headline)
                        HStack {
                            if let creator = item.creator {
                                Label(creator, systemImage: "person")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            if let minRank = item.minRank {
                                Text("Min: \(minRank)")
                                    .font(.caption).foregroundStyle(LSPDColors.warning)
                            }
                        }
                        HStack {
                            if let date = item.date {
                                Label(date, systemImage: "calendar")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            if let time = item.time {
                                Text(time).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            let count = item.enrollments?.count ?? 0
                            Label("\(count) Teilnehmer", systemImage: "person.2")
                                .font(.caption).foregroundStyle(LSPDColors.info)
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                let idsToDelete = indexSet.map { dbService.training[$0].id }
                for id in idsToDelete {
                    Task { await dbService.deleteTraining(id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Schulungen (\(dbService.training.count))")
        .toolbar {
            if authVM.hasPermission("training") {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddTraining = true } label: { Image(systemName: "plus") }
                }
            }
        }
        .sheet(isPresented: $showAddTraining) { AddTrainingView() }
        .sheet(item: $selectedTraining) { item in TrainingDetailView(training: item) }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Schulung hinzufügen
struct AddTrainingView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var minRank = ""
    @State private var date = ""
    @State private var time = ""
    @State private var googleDocsUrl = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Schulungsdetails") {
                    TextField("Titel", text: $title)
                    TextEditor(text: $description)
                        .frame(minHeight: 60)
                }
                Section("Planung") {
                    Picker("Min. Rang", selection: $minRank) {
                        Text("Alle").tag("")
                        ForEach(dbService.jobRanks.sorted(by: { $0.priority < $1.priority }), id: \.name) { rank in
                            Text(rank.name).tag(rank.name)
                        }
                    }
                    TextField("Datum (z.B. 2025-01-15)", text: $date)
                    TextField("Uhrzeit (z.B. 18:00)", text: $time)
                }
                Section("Material") {
                    TextField("Google Docs URL (optional)", text: $googleDocsUrl)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                }
            }
            .navigationTitle("Neue Schulung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Erstellen") {
                        let item = LSPDTraining(id: 0, title: title,
                                                creator: authVM.currentUser?.username,
                                                minRank: minRank.isEmpty ? nil : minRank,
                                                date: date.isEmpty ? nil : date,
                                                time: time.isEmpty ? nil : time,
                                                googleDocsUrl: googleDocsUrl.isEmpty ? nil : googleDocsUrl,
                                                enrollments: [],
                                                description: description.isEmpty ? nil : description)
                        Task {
                            await dbService.addTraining(item)
                            dismiss()
                        }
                    }
                    .disabled(title.isEmpty)
                }
            }
        }
    }
}

// MARK: - Schulung-Detail
struct TrainingDetailView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) var dismiss
    let training: LSPDTraining
    @State private var toastMessage: String?

    var currentTraining: LSPDTraining {
        dbService.training.first(where: { $0.id == training.id }) ?? training
    }

    var isEnrolled: Bool {
        currentTraining.enrollments?.contains(authVM.currentUser?.username ?? "") ?? false
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Details") {
                    LabeledContent("Titel", value: training.title)
                    if let desc = training.description { Text(desc) }
                    if let creator = training.creator { LabeledContent("Erstellt von", value: creator) }
                    if let minRank = training.minRank { LabeledContent("Min. Rang", value: minRank) }
                }

                Section("Termin") {
                    if let date = training.date { LabeledContent("Datum", value: date) }
                    if let time = training.time { LabeledContent("Uhrzeit", value: time) }
                }

                if let url = training.googleDocsUrl, !url.isEmpty, let parsedUrl = URL(string: url) {
                    Section("Material") {
                        Link("Google Docs öffnen", destination: parsedUrl)
                    }
                }

                Section("Teilnehmer (\(currentTraining.enrollments?.count ?? 0))") {
                    if let enrollments = currentTraining.enrollments {
                        ForEach(enrollments, id: \.self) { name in
                            Label(name, systemImage: "person")
                        }
                    }

                    Button {
                        Task {
                            await dbService.enrollInTraining(trainingId: training.id,
                                                             username: authVM.currentUser?.username ?? "")
                            toastMessage = "Eingeschrieben!"
                        }
                    } label: {
                        Label(isEnrolled ? "Bereits eingeschrieben" : "Einschreiben",
                              systemImage: isEnrolled ? "checkmark.circle.fill" : "plus.circle")
                    }
                    .disabled(isEnrolled)
                }
            }
            .navigationTitle("Schulung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } }
            }
            .toast(message: $toastMessage)
        }
    }
}
