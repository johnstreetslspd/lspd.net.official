import SwiftUI

// MARK: - FAQ & Hilfe
struct BuergerFAQView: View {
    @State private var expandedId: Int?

    let faqItems: [(id: Int, question: String, answer: String)] = [
        (1, "Wie bewerbe ich mich bei der LSPD?",
         "Nutzen Sie unser Online-Bewerbungsformular unter 'Bewerbungen'. Füllen Sie alle Pflichtfelder aus und beschreiben Sie Ihre Motivation."),
        (2, "Wie kann ich meinen Bewerbungsstatus prüfen?",
         "Gehen Sie zu 'Bewerbungsstatus' und geben Sie Ihren Tracking-Code ein, den Sie bei der Bewerbung erhalten haben."),
        (3, "Was sind die Voraussetzungen für eine Bewerbung?",
         "Sie müssen mindestens 18 Jahre alt sein, ein sauberes Führungszeugnis vorweisen und körperlich fit sein."),
        (4, "Wie erstatte ich eine Strafanzeige?",
         "Nutzen Sie das Formular unter 'Strafanzeige stellen'. Beschreiben Sie den Vorfall so detailliert wie möglich."),
        (5, "Wie kann ich die LSPD kontaktieren?",
         "Über unser Kontaktformular, per E-Mail an info@lspd.gov oder telefonisch unter 911 (Notfall) bzw. 311 (Nicht-Notfall)."),
        (6, "Wie lange dauert die Bearbeitung einer Bewerbung?",
         "In der Regel bearbeiten wir Bewerbungen innerhalb von 3-5 Werktagen. Sie werden per E-Mail benachrichtigt."),
        (7, "Kann ich eine eingereichte Bewerbung zurückziehen?",
         "Ja, kontaktieren Sie uns über das Anfragen-Formular mit Ihrem Tracking-Code und dem Wunsch zur Rücknahme."),
        (8, "Was passiert nach einer erfolgreichen Bewerbung?",
         "Sie werden zu einem persönlichen Gespräch eingeladen. Danach beginnt Ihre Ausbildungsphase als Trainee.")
    ]

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text("❓ Häufig gestellte Fragen")
                        .font(.title3.bold())
                    Text("Finden Sie Antworten auf die häufigsten Fragen")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .listRowBackground(Color.clear)
            }

            ForEach(faqItems, id: \.id) { item in
                VStack(alignment: .leading, spacing: 8) {
                    Button {
                        withAnimation(.spring()) {
                            expandedId = expandedId == item.id ? nil : item.id
                        }
                    } label: {
                        HStack {
                            Text(item.question)
                                .font(.subheadline.bold())
                                .multilineTextAlignment(.leading)
                            Spacer()
                            Image(systemName: expandedId == item.id ? "chevron.up" : "chevron.down")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if expandedId == item.id {
                        Text(item.answer)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(.top, 4)
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
        }
        .listStyle(.plain)
        .navigationTitle("FAQ")
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}
