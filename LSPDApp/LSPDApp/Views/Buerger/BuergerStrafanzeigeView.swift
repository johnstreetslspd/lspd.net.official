import SwiftUI

// MARK: - Strafanzeige stellen (Bürger)
struct BuergerStrafanzeigeView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var name = ""
    @State private var charge = ""
    @State private var description = ""
    @State private var accusedName = ""
    @State private var submitted = false

    var body: some View {
        ScrollView {
            if submitted {
                VStack(spacing: 20) {
                    Image(systemName: "checkmark.shield.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(.green)
                    Text("Strafanzeige eingereicht!")
                        .font(.title2.bold())
                    Text("Ihre Anzeige wurde erfolgreich aufgenommen und wird von unseren Beamten geprüft.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)

                    Button {
                        resetForm()
                    } label: {
                        Text("Weitere Anzeige erstatten")
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
                    // Info
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "exclamationmark.shield.fill")
                                .foregroundStyle(LSPDColors.danger)
                            Text("Strafanzeige erstatten")
                                .font(.title3.bold())
                        }
                        Text("Erstatten Sie eine Anzeige gegen eine Person. Bitte beschreiben Sie den Vorfall so detailliert wie möglich.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    // Formular
                    VStack(spacing: 16) {
                        FormField(label: "Ihr Name *", text: $name, placeholder: "Ihr vollständiger Name")
                        FormField(label: "Name des Beschuldigten *", text: $accusedName, placeholder: "Name der beschuldigten Person")
                        FormField(label: "Anklage / Vorwurf *", text: $charge, placeholder: "z.B. Diebstahl, Körperverletzung")

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Tathergang / Beschreibung *").font(.caption.bold()).foregroundStyle(.secondary)
                            TextEditor(text: $description)
                                .frame(minHeight: 120)
                                .padding(8)
                                .background(Color(.systemGray6).opacity(0.2))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }

                    // Hinweis
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                        Text("Falsche Anschuldigungen sind strafbar! Stellen Sie sicher, dass Ihre Angaben der Wahrheit entsprechen.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                    Button {
                        submitCharge()
                    } label: {
                        Text("Anzeige erstatten")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(LSPDColors.danger)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(name.isEmpty || charge.isEmpty || description.isEmpty || accusedName.isEmpty)
                }
                .padding()
            }
        }
        .navigationTitle("Strafanzeige")
        .background(LSPDColors.dark.ignoresSafeArea())
    }

    private func submitCharge() {
        let item = LSPDCharge(
            id: 0,
            chargeNumber: nil,
            aktenzeichen: nil,
            name: accusedName,
            citizenId: nil,
            type: charge,
            vergehen: nil,
            description: description,
            officer: nil,
            source: name,
            status: "Offen",
            date: ISO8601DateFormatter().string(from: Date())
        )
        Task {
            await dbService.addCharge(item)
            withAnimation { submitted = true }
        }
    }

    private func resetForm() {
        name = ""
        charge = ""
        description = ""
        accusedName = ""
        submitted = false
    }
}
