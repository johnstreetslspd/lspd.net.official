import SwiftUI

// MARK: - Bürger Presse / Pressebenachrichtigungen
struct BuergerPresseView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var selectedPress: LSPDPress?

    var publishedPress: [LSPDPress] {
        dbService.press
            .filter { $0.isPublished == true }
            .sorted { ($0.date ?? "") > ($1.date ?? "") }
    }

    var body: some View {
        List {
            if publishedPress.isEmpty {
                EmptyStateView(icon: "megaphone", title: "Keine Pressebenachrichtigungen",
                               subtitle: "Zurzeit gibt es keine veröffentlichten Pressemitteilungen")
                    .listRowBackground(Color.clear)
            }

            ForEach(publishedPress) { item in
                Button { selectedPress = item } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(item.title).font(.headline).lineLimit(2)
                            Spacer()
                            if let cat = item.category {
                                Text(cat)
                                    .font(.caption.bold())
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(LSPDColors.info.opacity(0.2))
                                    .foregroundStyle(LSPDColors.info)
                                    .clipShape(Capsule())
                            }
                        }
                        if let subtitle = item.subtitle, !subtitle.isEmpty {
                            Text(subtitle)
                                .font(.subheadline.bold())
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Text(item.content)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                        HStack {
                            if let author = item.author {
                                Label(author, systemImage: "person")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let date = item.date {
                                Text(formatISODate(date, dateStyle: .long, timeStyle: .none))
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
        }
        .listStyle(.plain)
        .navigationTitle("📢 Presse")
        .sheet(item: $selectedPress) { item in
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(item.title).font(.title2.bold())

                        if let subtitle = item.subtitle, !subtitle.isEmpty {
                            Text(subtitle)
                                .font(.title3)
                                .foregroundStyle(.secondary)
                        }

                        HStack {
                            if let author = item.author {
                                Label(author, systemImage: "person")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                            if let date = item.date {
                                Text("• \(formatISODate(date))")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                            if let cat = item.category {
                                Spacer()
                                Text(cat)
                                    .font(.caption.bold())
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(LSPDColors.info.opacity(0.2))
                                    .foregroundStyle(LSPDColors.info)
                                    .clipShape(Capsule())
                            }
                        }

                        Divider()

                        if let imageUrl = item.image, !imageUrl.isEmpty {
                            AsyncImage(url: URL(string: imageUrl)) { phase in
                                switch phase {
                                case .success(let image):
                                    image.resizable().aspectRatio(contentMode: .fit)
                                case .failure:
                                    Label("Bild konnte nicht geladen werden", systemImage: "photo")
                                        .font(.caption).foregroundStyle(.secondary)
                                case .empty:
                                    Color.gray.opacity(0.2)
                                @unknown default:
                                    Color.gray.opacity(0.2)
                                }
                            }
                            .frame(maxHeight: 200)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }

                        Text(item.content).font(.body)
                    }
                    .padding()
                }
                .navigationTitle("Pressemitteilung")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Fertig") { selectedPress = nil }
                    }
                }
                .background(LSPDColors.dark.ignoresSafeArea())
            }
        }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}
