import SwiftUI

// MARK: - Presseabteilung
struct PresseView: View {
    @EnvironmentObject var dbService: DatabaseService
    @State private var showAddPress = false
    @State private var selectedPress: LSPDPress?

    var body: some View {
        List {
            if dbService.press.isEmpty {
                EmptyStateView(icon: "newspaper", title: "Keine Nachrichten",
                               subtitle: "Noch keine Pressenachrichten erstellt")
                    .listRowBackground(Color.clear)
            }

            ForEach(dbService.press) { item in
                Button { selectedPress = item } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(item.title).font(.headline)
                            Spacer()
                            if let published = item.isPublished {
                                Image(systemName: published ? "eye" : "eye.slash")
                                    .foregroundStyle(published ? .green : .secondary)
                            }
                        }
                        Text(item.content).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                        HStack {
                            if let author = item.author {
                                Label(author, systemImage: "person").font(.caption).foregroundStyle(.secondary)
                            }
                            if let cat = item.category {
                                Text(cat).font(.caption).foregroundStyle(LSPDColors.info)
                            }
                            Spacer()
                            if let date = item.date {
                                Text(formatISODate(date, dateStyle: .short, timeStyle: .none))
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .listRowBackground(Color(.systemGray6).opacity(0.1))
            }
            .onDelete { indexSet in
                for idx in indexSet {
                    Task { await dbService.deletePress(dbService.press[idx].id) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Presse (\(dbService.press.count))")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddPress = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAddPress) { AddPressView() }
        .sheet(item: $selectedPress) { item in PressDetailView(press: item) }
        .background(LSPDColors.dark.ignoresSafeArea())
    }
}

// MARK: - Presse hinzufügen
struct AddPressView: View {
    @EnvironmentObject var dbService: DatabaseService
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) var dismiss
    @State private var title = ""
    @State private var content = ""
    @State private var category = ""
    @State private var isPublished = true

    var body: some View {
        NavigationStack {
            Form {
                Section("Nachricht") {
                    TextField("Titel", text: $title)
                    TextEditor(text: $content)
                        .frame(minHeight: 120)
                }
                Section("Details") {
                    TextField("Kategorie", text: $category)
                    Toggle("Veröffentlichen", isOn: $isPublished)
                }
            }
            .navigationTitle("Neue Nachricht")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Veröffentlichen") {
                        let item = LSPDPress(id: 0, title: title, content: content,
                                             author: authVM.currentUser?.username,
                                             date: ISO8601DateFormatter().string(from: Date()),
                                             category: category.isEmpty ? nil : category,
                                             isPublished: isPublished)
                        Task {
                            await dbService.addPress(item)
                            dismiss()
                        }
                    }
                    .disabled(title.isEmpty || content.isEmpty)
                }
            }
        }
    }
}

// MARK: - Presse-Detail
struct PressDetailView: View {
    @Environment(\.dismiss) var dismiss
    let press: LSPDPress

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(press.title)
                        .font(.title2.bold())

                    HStack {
                        if let author = press.author {
                            Label(author, systemImage: "person").font(.subheadline).foregroundStyle(.secondary)
                        }
                        if let date = press.date {
                            Text("• \(formatISODate(date))").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }

                    Divider()

                    Text(press.content)
                        .font(.body)
                }
                .padding()
            }
            .navigationTitle("Nachricht")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } }
            }
            .background(LSPDColors.dark.ignoresSafeArea())
        }
    }
}
