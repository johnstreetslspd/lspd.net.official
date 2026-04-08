import SwiftUI

// MARK: - Bürger Bewerbungsformular
struct BuergerBewerbungView: View {
    @EnvironmentObject var dbService: DatabaseService
    @Environment(\.dismiss) var dismiss
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
                // Bestätigung
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
                    // Info
                    VStack(alignment: .leading, spacing: 8) {
                        Text("📝 Online Bewerbung")
                            .font(.title3.bold())
                        Text("Füllen Sie das Formular aus, um sich bei der LSPD zu bewerben.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    // Formular
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

                    Button {
                        submitApplication()
                    } label: {
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
        .navigationTitle("Bewerbung")
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
