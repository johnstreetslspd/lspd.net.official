import SwiftUI

// MARK: - Fallübersicht
struct FalluebersichtView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var searchText = ""
    @State private var selectedTab = 0

    var allCases: [(type: String, title: String, citizen: String?, date: String?, status: String?)] {
        var cases: [(type: String, title: String, citizen: String?, date: String?, status: String?)] = []

        for cit in dbService.citations {
            cases.append(("Strafakte", cit.offense, cit.citizenName, cit.date, cit.status))
        }
        for charge in dbService.charges {
            cases.append(("Anzeige", charge.charge, charge.citizenName, charge.date, charge.status))
        }

        if !searchText.isEmpty {
            cases = cases.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                ($0.citizen ?? "").localizedCaseInsensitiveContains(searchText)
            }
        }

        return cases.sorted { ($0.date ?? "") > ($1.date ?? "") }
    }

    var body: some View {
        List {
            SearchBar(text: $searchText, placeholder: "Fall suchen...")
                .listRowBackground(Color.clear)

            // Statistik
            HStack(spacing: 16) {
                StatCard(label: "Strafakten", value: "\(dbService.citations.count)", color: LSPDColors.danger)
                StatCard(label: "Anzeigen", value: "\(dbService.charges.count)", color: .red)
                StatCard(label: "Gesamt", value: "\(dbService.citations.count + dbService.charges.count)", color: LSPDColors.primary)
            }
            .listRowBackground(Color.clear)

            if allCases.isEmpty {
                EmptyStateView(icon: "folder", title: "Keine Fälle",
                               subtitle: "Noch keine Fälle vorhanden")
                    .listRowBackground(Color.clear)
            }

            ForEach(Array(allCases.enumerated()), id: \.offset) { _, caseItem in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: caseItem.type == "Strafakte" ? "doc.badge.gearshape" : "exclamationmark.triangle")
                            .foregroundStyle(caseItem.type == "Strafakte" ? LSPDColors.danger : .red)
                        Text(caseItem.title).font(.headline)
                        Spacer()
                        if let status = caseItem.status {
                            StatusBadge(status: status)
                        }
                    }
                    HStack {
                        Text(caseItem.type)
                            .font(.caption.bold())
                            .foregroundStyle(caseItem.type == "Strafakte" ? LSPDColors.danger : .red)
                        if let citizen = caseItem.citizen {
                            Text("• \(citizen)").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let date = caseItem.date {
                            Text(formatISODate(date, dateStyle: .short, timeStyle: .none))
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
        }
        .listStyle(.plain)
        .navigationTitle("Fallübersicht")
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}
