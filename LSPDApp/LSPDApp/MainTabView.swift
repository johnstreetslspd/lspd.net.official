import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            MitarbeiterDashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "square.grid.2x2.fill")
                }
                .tag(0)

            BuergerDashboardView()
                .tabItem {
                    Label("Bürger", systemImage: "person.2.fill")
                }
                .tag(1)

            ProfileView()
                .tabItem {
                    Label("Profil", systemImage: "person.circle.fill")
                }
                .tag(2)
        }
        .tint(Color("AccentBlue"))
    }
}

// MARK: - Profil-Ansicht
struct ProfileView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var dbService: DatabaseService

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 16) {
                        Image(systemName: "shield.checkered")
                            .font(.system(size: 40))
                            .foregroundStyle(Color("AccentBlue"))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(authVM.currentUser?.username ?? "")
                                .font(.title2.bold())
                            Text(authVM.currentUser?.role ?? "")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            if let rank = authVM.currentUser?.jobRank {
                                Text(rank)
                                    .font(.caption)
                                    .foregroundStyle(Color("AccentGreen"))
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }

                Section("Status") {
                    LabeledContent("Status", value: authVM.currentUser?.status ?? "Unbekannt")
                    if let created = authVM.currentUser?.created {
                        LabeledContent("Erstellt", value: formatDate(created))
                    }
                    LabeledContent("Firebase", value: dbService.isConnected ? "Verbunden" : "Offline")
                }

                Section("Berechtigungen") {
                    let permissions = dbService.getPermissions(for: authVM.currentUser?.role ?? "")
                    if permissions.isEmpty {
                        Text("Keine Berechtigungen")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(permissions, id: \.self) { perm in
                            Label(perm.capitalized, systemImage: permissionIcon(perm))
                        }
                    }
                }

                Section {
                    Button(role: .destructive) {
                        authVM.logout()
                    } label: {
                        Label("Abmelden", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Profil")
        }
    }

    private func formatDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) {
            let df = DateFormatter()
            df.dateStyle = .medium
            df.timeStyle = .short
            df.locale = Locale(identifier: "de_DE")
            return df.string(from: date)
        }
        // Try without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: iso) {
            let df = DateFormatter()
            df.dateStyle = .medium
            df.timeStyle = .short
            df.locale = Locale(identifier: "de_DE")
            return df.string(from: date)
        }
        return iso
    }

    private func permissionIcon(_ perm: String) -> String {
        switch perm {
        case "users": return "person.2"
        case "ranks": return "star"
        case "employees": return "briefcase"
        case "citizens": return "person.text.rectangle"
        case "evidence": return "magnifyingglass"
        case "training": return "book"
        case "applications": return "doc.text"
        case "citations": return "doc.badge.gearshape"
        case "charges": return "exclamationmark.triangle"
        case "press": return "newspaper"
        case "requests": return "envelope"
        case "admin": return "gearshape"
        default: return "questionmark.circle"
        }
    }
}
