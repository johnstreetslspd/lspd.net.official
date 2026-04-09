import SwiftUI

// MARK: - Bürger Anfragen & Beschwerden
struct BuergerAnfragenView: View {
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $selectedTab) {
                Text("Neue Anfrage").tag(0)
                Text("Alle Anfragen").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            if selectedTab == 0 {
                AnfragenFormView()
            } else {
                AnfragenListeView()
            }
        }
        .navigationTitle("Anfragen")
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Anfragen-Formular
private struct AnfragenFormView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var name = ""
    @State private var email = ""
    @State private var subject = ""
    @State private var message = ""
    @State private var type = "Anfrage"
    @State private var submitted = false

    let typeOptions = ["Anfrage", "Beschwerde", "Lob", "Sonstiges"]

    var body: some View {
        ScrollView {
            if submitted {
                VStack(spacing: 20) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(.green)
                    Text("Anfrage eingereicht!")
                        .font(.title2.bold())
                    Text("Ihre Anfrage wurde erfolgreich übermittelt. Wir werden uns schnellstmöglich bei Ihnen melden.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)

                    Button { resetForm() } label: {
                        Text("Neue Anfrage stellen")
                            .font(.headline)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(LSPDColors.primary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(30)
            } else {
                VStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("📧 Anfragen & Beschwerden")
                            .font(.title3.bold())
                        Text("Haben Sie ein Anliegen? Teilen Sie es uns mit.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(spacing: 16) {
                        FormField(label: "Name *", text: $name, placeholder: "Ihr Name")
                        FormField(label: "E-Mail", text: $email, placeholder: "email@example.com", keyboard: .emailAddress)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Typ").font(.caption.bold()).foregroundStyle(.secondary)
                            Picker("Typ", selection: $type) {
                                ForEach(typeOptions, id: \.self) { Text($0) }
                            }
                            .pickerStyle(.segmented)
                        }

                        FormField(label: "Betreff *", text: $subject, placeholder: "Betreff Ihrer Anfrage")

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Nachricht *").font(.caption.bold()).foregroundStyle(.secondary)
                            TextEditor(text: $message)
                                .frame(minHeight: 120)
                                .padding(8)
                                .background(Color(.systemGray6).opacity(0.2))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }

                    Button { submitRequest() } label: {
                        Text("Anfrage absenden")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(LSPDColors.primary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(name.isEmpty || subject.isEmpty || message.isEmpty)
                }
                .padding()
            }
        }
        .background(LSPDColors.dark.ignoresSafeArea())
    }

    private func submitRequest() {
        let req = LSPDRequest(
            id: 0, name: name,
            email: email.isEmpty ? nil : email,
            subject: subject, message: message,
            type: type, status: "Offen",
            date: ISO8601DateFormatter().string(from: Date())
        )
        Task {
            await dbService.addRequest(req)
            withAnimation { submitted = true }
        }
    }

    private func resetForm() {
        name = ""
        email = ""
        subject = ""
        message = ""
        type = "Anfrage"
        submitted = false
    }
}

// MARK: - Anfragen-Liste
private struct AnfragenListeView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var selectedRequest: LSPDRequest?

    var sortedRequests: [LSPDRequest] {
        dbService.requests.sorted { ($0.date ?? "") > ($1.date ?? "") }
    }

    var body: some View {
        List {
            if sortedRequests.isEmpty {
                EmptyStateView(icon: "envelope", title: "Keine Anfragen",
                               subtitle: "Noch keine Anfragen eingegangen")
                    .listRowBackground(Color.clear)
            }

            ForEach(sortedRequests) { req in
                Button { selectedRequest = req } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(req.subject).font(.headline).lineLimit(1)
                            Spacer()
                            StatusBadge(status: req.status ?? "Offen")
                        }
                        HStack(spacing: 6) {
                            Label(req.name, systemImage: "person")
                                .font(.caption).foregroundStyle(.secondary)
                            if let type = req.type {
                                Text("• \(type)").font(.caption).foregroundStyle(LSPDColors.info)
                            }
                        }
                        if let date = req.date {
                            Text(formatISODate(date, dateStyle: .short, timeStyle: .short))
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
        }
        .listStyle(.plain)
        .background(LSPDColors.dark.ignoresSafeArea())
        .sheet(item: $selectedRequest) { req in BuergerAnfrageDetailView(request: req) }
    }
}

// MARK: - Anfrage-Detailansicht (Bürger – nur lesend)
struct BuergerAnfrageDetailView: View {
    @Environment(\.dismiss) var dismiss
    let request: LSPDRequest

    var body: some View {
        NavigationStack {
            List {
                Section("Anfrage") {
                    LabeledContent("Name", value: request.name)
                    if let email = request.email { LabeledContent("E-Mail", value: email) }
                    LabeledContent("Betreff", value: request.subject)
                    if let type = request.type { LabeledContent("Typ", value: type) }
                    if let date = request.date {
                        LabeledContent("Datum", value: formatISODate(date))
                    }
                    LabeledContent("Status", value: request.status ?? "Offen")
                }

                Section("Nachricht") {
                    Text(request.message)
                }

                if let response = request.response, !response.isEmpty {
                    Section("Antwort der LSPD") {
                        Text(response)
                    }
                }
            }
            .navigationTitle("Anfrage")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } }
            }
            .background(LSPDColors.dark.ignoresSafeArea())
        }
    }
}
