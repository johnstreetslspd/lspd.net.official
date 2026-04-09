import SwiftUI

struct BuergerDashboardView: View {
    @EnvironmentObject var dbService: DatabaseService

    private var publishedPressCount: Int {
        dbService.press.filter { $0.isPublished == true }.count
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    VStack(spacing: 8) {
                        HStack {
                            Image(systemName: "shield.fill")
                                .font(.title)
                            Text("LSPD BÜRGERDIENSTE")
                                .font(.title2.bold())
                        }
                        .foregroundStyle(LSPDColors.primary)
                        Text("Öffentliche Dienste & Informationen")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top)

                    // Dienste
                    Text("🌐 Unsere Dienstleistungen")
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        NavigationLink { BuergerBewerbungView() } label: {
                            DashboardCard(title: "Bewerbungen", icon: "doc.text.fill",
                                          count: dbService.applications.count,
                                          subtitle: "Online bewerben", color: LSPDColors.primary)
                        }

                        NavigationLink { BuergerStatusView() } label: {
                            DashboardCard(title: "Status", icon: "magnifyingglass",
                                          subtitle: "Bewerbungsstatus prüfen", color: LSPDColors.info)
                        }

                        NavigationLink { BuergerAnfragenView() } label: {
                            DashboardCard(title: "Anfragen", icon: "envelope.fill",
                                          count: dbService.requests.count,
                                          subtitle: "Anfragen & Beschwerden", color: .orange)
                        }

                        NavigationLink { BuergerNewsView() } label: {
                            DashboardCard(title: "News", icon: "newspaper.fill",
                                          count: dbService.news.count,
                                          subtitle: "Aktuelle Meldungen", color: .mint)
                        }

                        NavigationLink { BuergerFAQView() } label: {
                            DashboardCard(title: "FAQ & Hilfe", icon: "questionmark.circle.fill",
                                          subtitle: "Häufige Fragen", color: LSPDColors.secondary)
                        }

                        NavigationLink { BuergerKontaktView() } label: {
                            DashboardCard(title: "Kontakt", icon: "phone.fill",
                                          subtitle: "Notfall & Kontakt", color: LSPDColors.primaryBright)
                        }

                        NavigationLink { BuergerStrafanzeigeView() } label: {
                            DashboardCard(title: "Strafanzeige", icon: "exclamationmark.shield.fill",
                                          subtitle: "Anzeige erstatten", color: LSPDColors.danger)
                        }

                        NavigationLink { BuergerPresseView() } label: {
                            DashboardCard(title: "Presse", icon: "megaphone.fill",
                                          count: publishedPressCount,
                                          subtitle: "Pressemitteilungen", color: .purple)
                        }
                    }
                    .padding(.horizontal)

                    // Statistiken
                    VStack(alignment: .leading, spacing: 12) {
                        Text("📊 Übersicht")
                            .font(.headline)
                            .padding(.horizontal)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            StatCard(label: "Beamte", value: "\(dbService.users.count)", color: LSPDColors.primary)
                            StatCard(label: "News", value: "\(dbService.news.count)", color: .mint)
                            StatCard(label: "Bewerbungen", value: "\(dbService.applications.count)", color: .green)
                            StatCard(label: "Presse", value: "\(publishedPressCount)", color: .purple)
                            StatCard(label: "Anfragen", value: "\(dbService.requests.count)", color: .orange)
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .background(LSPDColors.dark.ignoresSafeArea())
            .navigationTitle("Bürgerdienste")
        }
    }
}
