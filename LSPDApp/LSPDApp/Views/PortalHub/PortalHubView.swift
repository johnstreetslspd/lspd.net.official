import SwiftUI

struct PortalHubView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var dbService: DatabaseService
    @State private var showLogin = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Header
                    VStack(spacing: 12) {
                        HStack {
                            Image(systemName: "shield.checkered")
                                .font(.system(size: 40))
                            Text("LSPD")
                                .font(.system(size: 36, weight: .black))
                        }
                        .foregroundStyle(
                            LinearGradient(colors: [LSPDColors.primary, LSPDColors.secondary],
                                           startPoint: .leading, endPoint: .trailing)
                        )

                        Text("Los Santos Police Department")
                            .font(.title3)
                            .foregroundStyle(.secondary)

                        Text("„To Protect and Serve"")
                            .font(.subheadline.italic())
                            .foregroundStyle(LSPDColors.secondary)
                    }
                    .padding(.vertical, 30)

                    // Portal-Karten
                    VStack(spacing: 16) {
                        // Bürger-Portal
                        NavigationLink {
                            BuergerDashboardView()
                        } label: {
                            PortalCard(
                                title: "Bürgerdienste",
                                subtitle: "Bewerbungen, News, Anfragen & mehr",
                                icon: "person.2.fill",
                                color: LSPDColors.primary
                            )
                        }

                        // Mitarbeiter-Portal
                        Button {
                            showLogin = true
                        } label: {
                            PortalCard(
                                title: "Mitarbeiterportal",
                                subtitle: "Internes System für LSPD Beamte",
                                icon: "lock.shield.fill",
                                color: LSPDColors.warning
                            )
                        }

                        // Info-Karten
                        HStack(spacing: 12) {
                            NavigationLink {
                                InfoPageView(title: "Über uns", content: überUnsContent)
                            } label: {
                                MiniCard(title: "Über uns", icon: "info.circle.fill", color: LSPDColors.info)
                            }

                            NavigationLink {
                                InfoPageView(title: "Karriere", content: karriereContent)
                            } label: {
                                MiniCard(title: "Karriere", icon: "briefcase.fill", color: LSPDColors.secondary)
                            }

                            NavigationLink {
                                InfoPageView(title: "Kontakt", content: kontaktContent)
                            } label: {
                                MiniCard(title: "Kontakt", icon: "phone.fill", color: LSPDColors.primaryBright)
                            }
                        }
                    }
                    .padding()

                    // Firebase Status
                    HStack {
                        Circle()
                            .fill(dbService.isConnected ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                        Text(dbService.isConnected ? "Firebase verbunden" : "Offline")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 20)
                }
            }
            .background(LSPDColors.dark.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showLogin) {
                LoginView()
            }
            .onAppear {
                dbService.startListening()
            }
        }
    }
}

// MARK: - Portal-Karte
struct PortalCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 36))
                .foregroundStyle(color)
                .frame(width: 60)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemGray6).opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(color.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

// MARK: - Mini-Karte
struct MiniCard: View {
    let title: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
            Text(title)
                .font(.caption.bold())
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemGray6).opacity(0.15))
        )
    }
}

// MARK: - Info-Seite
struct InfoPageView: View {
    let title: String
    let content: String

    var body: some View {
        ScrollView {
            Text(content)
                .padding()
        }
        .navigationTitle(title)
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Info-Inhalte
private let überUnsContent = """
Los Santos Police Department (LSPD)

Das LSPD ist die Hauptpolizeibehörde von Los Santos. Wir sind verantwortlich für die Aufrechterhaltung von Recht und Ordnung in der Stadt.

Unsere Mission:
• Schutz der Bürger von Los Santos
• Verbrechensbekämpfung und Prävention
• Förderung der öffentlichen Sicherheit
• Zusammenarbeit mit der Gemeinschaft

Geschichte:
Das LSPD wurde gegründet, um den Bürgern von Los Santos einen sicheren Lebensraum zu bieten. Mit modernster Ausrüstung und gut ausgebildeten Beamten stehen wir für Sicherheit und Gerechtigkeit.
"""

private let karriereContent = """
Karriere beim LSPD

Werden Sie Teil unseres Teams! Das LSPD sucht engagierte Bürger, die sich für Recht und Ordnung einsetzen möchten.

Voraussetzungen:
• Mindestalter: 18 Jahre
• Sauberes Führungszeugnis
• Körperliche Fitness
• Teamfähigkeit und Kommunikationsstärke

Bewerbungsprozess:
1. Online-Bewerbung einreichen
2. Persönliches Gespräch
3. Ausbildungsphase als Trainee
4. Übernahme als vollwertiger Officer

Karrierestufen:
Trainee → Officer → Senior Officer → Sergeant → Lieutenant → Captain → Commander → Deputy Chief → Assistant Chief → Chief of Police
"""

private let kontaktContent = """
Kontakt & Notfall

Notruf: 911
Nicht-Notfall: 311

Los Santos Police Department
Hauptquartier: Mission Row
Los Santos, San Andreas

E-Mail: info@lspd.gov
Website: www.lspd.gov

Öffnungszeiten Bürgerbüro:
Mo-Fr: 08:00 - 18:00 Uhr
Sa: 09:00 - 14:00 Uhr
So: Geschlossen

Für Notfälle sind wir 24/7 erreichbar!
"""
