import SwiftUI

// MARK: - Bürger Bewerbungen (Tabs: Bewerben / Alle Bewerbungen)
struct BuergerBewerbungView: View {
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $selectedTab) {
                Text("Bewerben").tag(0)
                Text("Alle Bewerbungen").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            if selectedTab == 0 {
                BewerbungFormView()
            } else {
                BewerbungenListeView()
            }
        }
        .navigationTitle("Bewerbungen")
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Bewerbungsformular
private struct BewerbungFormView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var age = ""
    @State private var motivation = ""
    @State private var experience = ""
    @State private var submitted = false
    @State private var trackingCode = ""

    var body: some View {
        ScrollView {
            if submitted {
                VStack(spacing: 20) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(.green)
                    Text("Bewerbung eingereicht!")
                        .font(.title2.bold())
                    Text("Vielen Dank für Ihre Bewerbung bei der LSPD.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)

                    VStack(spacing: 8) {
                        Text("Ihr Tracking-Code:")
                            .font(.subheadline)
                        Text(trackingCode)
                            .font(.title3.monospaced().bold())
                            .foregroundStyle(LSPDColors.secondary)
                            .padding()
                            .background(Color(.systemGray6).opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    Text("Bewahren Sie diesen Code auf, um den Status Ihrer Bewerbung zu verfolgen.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(30)
            } else {
                VStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("📝 Online Bewerbung")
                            .font(.title3.bold())
                        Text("Füllen Sie das Formular aus, um sich bei der LSPD zu bewerben.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(spacing: 16) {
                        FormField(label: "Vollständiger Name *", text: $name, placeholder: "Max Mustermann")
                        FormField(label: "E-Mail *", text: $email, placeholder: "max@example.com", keyboard: .emailAddress)
                        FormField(label: "Telefon", text: $phone, placeholder: "+49...", keyboard: .phonePad)
                        FormField(label: "Alter", text: $age, placeholder: "25", keyboard: .numberPad)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Motivation *").font(.caption.bold()).foregroundStyle(.secondary)
                            TextEditor(text: $motivation)
                                .frame(minHeight: 100)
                                .padding(8)
                                .background(Color(.systemGray6).opacity(0.2))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Erfahrung").font(.caption.bold()).foregroundStyle(.secondary)
                            TextEditor(text: $experience)
                                .frame(minHeight: 80)
                                .padding(8)
                                .background(Color(.systemGray6).opacity(0.2))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }

                    Button { submitApplication() } label: {
                        Text("Bewerbung absenden")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(LSPDColors.primary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(name.isEmpty || email.isEmpty || motivation.isEmpty)
                }
                .padding()
            }
        }
        .background(LSPDColors.dark.ignoresSafeArea())
    }

    private func submitApplication() {
        let code = "LSPD-\(String(format: "%06d", Int.random(in: 100000...999999)))"
        trackingCode = code

        let app = LSPDApplication(
            id: 0,
            applicantName: name,
            email: email.isEmpty ? nil : email,
            phone: phone.isEmpty ? nil : phone,
            age: age.isEmpty ? nil : age,
            motivation: motivation.isEmpty ? nil : motivation,
            experience: experience.isEmpty ? nil : experience,
            status: "Offen",
            date: ISO8601DateFormatter().string(from: Date()),
            trackingCode: code
        )

        Task {
            await dbService.addApplication(app)
            withAnimation { submitted = true }
        }
    }
}

// MARK: - Bewerbungen-Liste (Bürger)
private struct BewerbungenListeView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var selectedApp: LSPDApplication?

    var sortedApps: [LSPDApplication] {
        dbService.applications.sorted { ($0.date ?? "") > ($1.date ?? "") }
    }

    var body: some View {
        List {
            if sortedApps.isEmpty {
                EmptyStateView(icon: "doc.text", title: "Keine Bewerbungen",
                               subtitle: "Noch keine Bewerbungen eingegangen")
                    .listRowBackground(Color.clear)
            }

            ForEach(sortedApps) { app in
                Button { selectedApp = app } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(app.applicantName).font(.headline)
                            Spacer()
                            StatusBadge(status: app.status)
                        }
                        if let date = app.date {
                            Text(formatISODate(date, dateStyle: .medium, timeStyle: .none))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        if let code = app.trackingCode {
                            Text("Code: \(code)")
                                .font(.caption.monospaced())
                                .foregroundStyle(LSPDColors.info)
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
        }
        .listStyle(.plain)
        .background(LSPDColors.dark.ignoresSafeArea())
        .sheet(item: $selectedApp) { app in BuergerBewerbungDetailView(application: app) }
    }
}

// MARK: - Bewerbung-Detailansicht (Bürger – nur lesend)
struct BuergerBewerbungDetailView: View {
    @Environment(\.dismiss) var dismiss
    let application: LSPDApplication

    var body: some View {
        NavigationStack {
            List {
                Section("Bewerber") {
                    LabeledContent("Name", value: application.applicantName)
                    if let email = application.email { LabeledContent("E-Mail", value: email) }
                    if let phone = application.phone { LabeledContent("Telefon", value: phone) }
                    if let age = application.age { LabeledContent("Alter", value: age) }
                    if let code = application.trackingCode {
                        LabeledContent("Tracking-Code", value: code)
                    }
                    LabeledContent("Status", value: application.status)
                    if let date = application.date {
                        LabeledContent("Eingereicht", value: formatISODate(date))
                    }
                }

                if let motivation = application.motivation, !motivation.isEmpty {
                    Section("Motivation") { Text(motivation) }
                }

                if let notes = application.reviewNotes, !notes.isEmpty {
                    Section("Anmerkungen der LSPD") { Text(notes) }
                }
            }
            .navigationTitle("Bewerbung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } }
            }
            .background(LSPDColors.dark.ignoresSafeArea())
        }
    }
}

// MARK: - Formular-Feld
struct FormField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption.bold()).foregroundStyle(.secondary)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .padding(12)
                .background(Color(.systemGray6).opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
        }
    }
}
