import SwiftUI

// MARK: - Kontakt & Notfall
struct BuergerKontaktView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Notfall
                VStack(spacing: 12) {
                    Image(systemName: "phone.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(.red)
                    Text("Notruf")
                        .font(.title2.bold())
                    if let telUrl = URL(string: "tel:911") {
                        Link(destination: telUrl) {
                            Text("911")
                                .font(.system(size: 48, weight: .black))
                                .foregroundStyle(.red)
                        }
                    }
                    Text("Für lebensbedrohliche Notfälle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.red.opacity(0.1))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.red.opacity(0.3), lineWidth: 1))
                )

                // Nicht-Notfall
                VStack(spacing: 12) {
                    Image(systemName: "phone.badge.checkmark")
                        .font(.system(size: 30))
                        .foregroundStyle(LSPDColors.primary)
                    Text("Nicht-Notfall")
                        .font(.title3.bold())
                    if let telUrl = URL(string: "tel:311") {
                        Link(destination: telUrl) {
                            Text("311")
                                .font(.system(size: 36, weight: .bold))
                                .foregroundStyle(LSPDColors.primary)
                        }
                    }
                    Text("Für allgemeine Anfragen und Meldungen")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(20)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color(.systemGray6).opacity(0.15))
                )

                // Kontaktdaten
                VStack(alignment: .leading, spacing: 16) {
                    Text("📍 Kontaktdaten")
                        .font(.headline)

                    ContactRow(icon: "building.2", title: "Hauptquartier", value: "Mission Row, Los Santos")
                    ContactRow(icon: "envelope", title: "E-Mail", value: "info@lspd.gov")
                    ContactRow(icon: "globe", title: "Website", value: "www.lspd.gov")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color(.systemGray6).opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 16))

                // Öffnungszeiten
                VStack(alignment: .leading, spacing: 12) {
                    Text("🕐 Öffnungszeiten Bürgerbüro")
                        .font(.headline)

                    HoursRow(day: "Montag – Freitag", hours: "08:00 – 18:00")
                    HoursRow(day: "Samstag", hours: "09:00 – 14:00")
                    HoursRow(day: "Sonntag", hours: "Geschlossen")

                    Text("Für Notfälle sind wir 24/7 erreichbar!")
                        .font(.caption.bold())
                        .foregroundStyle(LSPDColors.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color(.systemGray6).opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .padding()
        }
        .navigationTitle("Kontakt")
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Kontakt-Zeile
struct ContactRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(LSPDColors.primary)
                .frame(width: 24)
            VStack(alignment: .leading) {
                Text(title).font(.caption).foregroundStyle(.secondary)
                Text(value).font(.subheadline)
            }
        }
    }
}

// MARK: - Öffnungszeiten-Zeile
struct HoursRow: View {
    let day: String
    let hours: String

    var body: some View {
        HStack {
            Text(day).font(.subheadline)
            Spacer()
            Text(hours).font(.subheadline.bold()).foregroundStyle(hours == "Geschlossen" ? .red : .white)
        }
    }
}
