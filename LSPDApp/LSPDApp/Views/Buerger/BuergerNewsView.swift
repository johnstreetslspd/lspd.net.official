import SwiftUI

// MARK: - Bürger News
struct BuergerNewsView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var selectedNews: LSPDNews?

    var body: some View {
        List {
            if dbService.news.isEmpty {
                EmptyStateView(icon: "newspaper", title: "Keine Nachrichten",
                               subtitle: "Zurzeit gibt es keine aktuellen Nachrichten")
                    .listRowBackground(Color.clear)
            }

            ForEach(dbService.news.sorted(by: { ($0.date ?? "") > ($1.date ?? "") })) { item in
                Button { selectedNews = item } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.title)
                            .font(.headline)
                        Text(item.content)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                        if let date = item.date {
                            Text(formatISODate(date, dateStyle: .long, timeStyle: .none))
                                .font(.caption)
                                .foregroundStyle(LSPDColors.info)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
        }
        .listStyle(.plain)
        .navigationTitle("📰 News")
        .sheet(item: $selectedNews) { news in
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(news.title)
                            .font(.title2.bold())
                        if let date = news.date {
                            Text(formatISODate(date))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Divider()
                        Text(news.content)
                            .font(.body)
                    }
                    .padding()
                }
                .navigationTitle("Nachricht")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Fertig") { selectedNews = nil }
                    }
                }
                .background(LSPDColors.dark.ignoresSafeArea())
            }
        }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}
