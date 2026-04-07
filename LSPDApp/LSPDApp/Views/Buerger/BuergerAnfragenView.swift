import SwiftUI

// MARK: - Bürger Anfragen & Beschwerden
struct BuergerAnfragenView: View {
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

                    Button {
                        resetForm()
                    } label: {
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

                    Button {
                        submitRequest()
                    } label: {
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
        .navigationTitle("Anfragen")
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
