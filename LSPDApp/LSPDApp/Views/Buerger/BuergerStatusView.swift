import SwiftUI

// MARK: - Bewerbungsstatus prüfen
struct BuergerStatusView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var trackingCode = ""
    @State private var foundApp: LSPDApplication?
    @State private var searched = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Info
                VStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 40))
                        .foregroundStyle(LSPDColors.info)
                    Text("Bewerbungsstatus prüfen")
                        .font(.title3.bold())
                    Text("Geben Sie Ihren Tracking-Code ein, um den aktuellen Status Ihrer Bewerbung zu sehen.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 20)

                // Suchfeld
                VStack(spacing: 12) {
                    TextField("Tracking-Code (z.B. LSPD-123456)", text: $trackingCode)
                        .textFieldStyle(.plain)
                        .padding(14)
                        .background(Color(.systemGray6).opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()

                    Button {
                        searchApplication()
                    } label: {
                        Text("Status prüfen")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(LSPDColors.primary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(trackingCode.isEmpty)
                }
                .padding(.horizontal)

                // Ergebnis
                if searched {
                    if let app = foundApp {
                        VStack(spacing: 16) {
                            StatusBadge(status: app.status)

                            VStack(spacing: 8) {
                                LabeledContent("Name", value: app.applicantName)
                                LabeledContent("Status", value: app.status)
                                if let date = app.date {
                                    LabeledContent("Eingereicht", value: formatISODate(date))
                                }
                                if let notes = app.reviewNotes, !notes.isEmpty {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Anmerkungen:").font(.caption.bold())
                                        Text(notes).font(.subheadline)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                            .padding()
                            .background(Color(.systemGray6).opacity(0.15))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .padding(.horizontal)
                    } else {
                        VStack(spacing: 8) {
                            Image(systemName: "xmark.circle")
                                .font(.system(size: 40))
                                .foregroundStyle(.red)
                            Text("Keine Bewerbung gefunden")
                                .font(.headline)
                            Text("Überprüfen Sie Ihren Tracking-Code und versuchen Sie es erneut.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                    }
                }

                Spacer()
            }
            .padding()
        }
        .navigationTitle("Status")
        .background(LSPDColors.dark.ignoresSafeArea())
    }

    private func searchApplication() {
        foundApp = dbService.applications.first(where: {
            ($0.trackingCode ?? "").lowercased() == trackingCode.lowercased()
        })
        searched = true
    }
}
