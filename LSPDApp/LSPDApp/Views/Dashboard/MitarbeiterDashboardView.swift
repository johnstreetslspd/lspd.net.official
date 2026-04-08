import SwiftUI

struct MitarbeiterDashboardView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var dbService: DatabaseService
    @State private var toastMessage: String?
    @State private var toastIsError = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Willkommen
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Willkommen, \(authVM.currentUser?.username ?? "")")
                                .font(.title2.bold())
                            HStack {
                                StatusBadge(status: authVM.currentUser?.status ?? "")
                                Text(authVM.currentUser?.role ?? "")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if let rank = authVM.currentUser?.jobRank {
                                    Text("• \(rank)")
                                        .font(.caption)
                                        .foregroundStyle(LSPDColors.secondary)
                                }
                            }
                        }
                        Spacer()
                    }
                    .padding(.horizontal)

                    // Dashboard-Karten
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 12) {

                        if authVM.hasPermission("users") {
                            NavigationLink { NutzerView() } label: {
                                DashboardCard(title: "Nutzer", icon: "person.2.fill",
                                              count: dbService.users.count,
                                              subtitle: "Benutzerkonten", color: LSPDColors.primary)
                            }
                        }

                        if authVM.hasPermission("ranks") {
                            NavigationLink { RaengeView() } label: {
                                DashboardCard(title: "Ränge", icon: "star.fill",
                                              count: dbService.jobRanks.count,
                                              subtitle: "Dienstgrade", color: LSPDColors.warning)
                            }
                        }

                        if authVM.hasPermission("citizens") {
                            NavigationLink { BuergerListView() } label: {
                                DashboardCard(title: "Bürger", icon: "person.text.rectangle",
                                              count: dbService.citizens.count,
                                              subtitle: "Bürgerdatenbank", color: LSPDColors.info)
                            }
                        }

                        if authVM.hasPermission("evidence") {
                            NavigationLink { BeweiseView() } label: {
                                DashboardCard(title: "Beweise", icon: "magnifyingglass",
                                              count: dbService.evidence.count,
                                              subtitle: "Beweismittel", color: .purple)
                            }
                        }

                        NavigationLink { SchulungenView() } label: {
                            DashboardCard(title: "Schulungen", icon: "book.fill",
                                          count: dbService.training.count,
                                          subtitle: "Ausbildung", color: LSPDColors.info)
                        }

                        if authVM.hasPermission("applications") {
                            NavigationLink { BewerbungenView() } label: {
                                DashboardCard(title: "Bewerbungen", icon: "doc.text.fill",
                                              count: dbService.applications.count,
                                              subtitle: "Bewerbungen", color: .green)
                            }
                        }

                        if authVM.hasPermission("requests") {
                            NavigationLink { SonstigesView() } label: {
                                DashboardCard(title: "Sonstiges", icon: "envelope.fill",
                                              count: dbService.requests.count,
                                              subtitle: "Anfragen", color: .orange)
                            }
                        }

                        if authVM.hasPermission("citations") {
                            NavigationLink { StrafaktenView() } label: {
                                DashboardCard(title: "Strafakten", icon: "doc.badge.gearshape",
                                              count: dbService.citations.count,
                                              subtitle: "Strafakten", color: LSPDColors.danger)
                            }
                        }

                        if authVM.hasPermission("charges") {
                            NavigationLink { AnzeigenView() } label: {
                                DashboardCard(title: "Anzeigen", icon: "exclamationmark.triangle.fill",
                                              count: dbService.charges.count,
                                              subtitle: "Anzeigen", color: .red)
                            }
                        }

                        if authVM.hasPermission("citations") {
                            NavigationLink { FalluebersichtView() } label: {
                                DashboardCard(title: "Fallübersicht", icon: "folder.fill",
                                              count: dbService.citations.count + dbService.charges.count,
                                              subtitle: "Alle Fälle", color: .indigo)
                            }
                        }

                        if authVM.hasPermission("press") {
                            NavigationLink { PresseView() } label: {
                                DashboardCard(title: "Presse", icon: "newspaper.fill",
                                              count: dbService.press.count,
                                              subtitle: "Nachrichten", color: .mint)
                            }
                        }

                        if authVM.hasPermission("admin") {
                            NavigationLink { AdminView() } label: {
                                DashboardCard(title: "Admin", icon: "gearshape.fill",
                                              subtitle: "Rollen & System", color: LSPDColors.danger)
                            }
                        }
                    }
                    .padding(.horizontal)

                    // Übersicht
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Übersicht")
                            .font(.headline)
                            .padding(.horizontal)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            StatCard(label: "Beamte", value: "\(dbService.users.count)", color: LSPDColors.primary)
                            StatCard(label: "Bürger", value: "\(dbService.citizens.count)", color: LSPDColors.info)
                            StatCard(label: "Beweise", value: "\(dbService.evidence.count)", color: .purple)
                            StatCard(label: "Strafakten", value: "\(dbService.citations.count)", color: LSPDColors.danger)
                            StatCard(label: "Anzeigen", value: "\(dbService.charges.count)", color: .red)
                            StatCard(label: "Offene Bew.", value: "\(dbService.applications.filter { $0.status == "Offen" }.count)", color: .green)
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .background(LSPDColors.dark.ignoresSafeArea())
            .navigationTitle("Dashboard")
            .toast(message: $toastMessage, isError: $toastIsError)
        }
    }
}

// MARK: - Statistik-Karte
struct StatCard: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2.bold())
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color(.systemGray6).opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
