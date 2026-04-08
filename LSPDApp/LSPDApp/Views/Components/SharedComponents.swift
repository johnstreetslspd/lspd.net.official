import SwiftUI

// MARK: - Dashboard-Karte
struct DashboardCard: View {
    let title: String
    let icon: String
    let count: Int?
    let subtitle: String
    let color: Color

    init(title: String, icon: String, count: Int? = nil, subtitle: String = "", color: Color = Color("AccentBlue")) {
        self.title = title
        self.icon = icon
        self.count = count
        self.subtitle = subtitle
        self.color = color
    }

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 28))
                .foregroundStyle(color)

            Text(title)
                .font(.headline)
                .foregroundStyle(.white)

            if let count = count {
                Text("\(count)")
                    .font(.title.bold())
                    .foregroundStyle(Color("AccentGreen"))
            }

            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
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

// MARK: - Suchleiste
struct SearchBar: View {
    @Binding var text: String
    var placeholder: String = "Suchen..."

    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(10)
        .background(Color(.systemGray6).opacity(0.2))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Toast-Nachricht
struct ToastModifier: ViewModifier {
    @Binding var message: String?
    @Binding var isError: Bool

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            if let msg = message {
                Text(msg)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(isError ? Color.red : Color("AccentGreen"))
                    .clipShape(Capsule())
                    .shadow(radius: 10)
                    .padding(.top, 50)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                            withAnimation { message = nil }
                        }
                    }
            }
        }
        .animation(.spring(), value: message)
    }
}

extension View {
    func toast(message: Binding<String?>, isError: Binding<Bool> = .constant(false)) -> some View {
        modifier(ToastModifier(message: message, isError: isError))
    }
}

// MARK: - Status-Badge
struct StatusBadge: View {
    let status: String

    var color: Color {
        switch status.lowercased() {
        case "aktiv", "genehmigt", "angenommen", "offen": return .green
        case "gesperrt", "abgelehnt", "geschlossen": return .red
        case "ausstehend", "in bearbeitung": return .orange
        default: return .gray
        }
    }

    var body: some View {
        Text(status)
            .font(.caption.bold())
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color)
            .clipShape(Capsule())
    }
}

// MARK: - Leerer Zustand
struct EmptyStateView: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 50))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.title3.bold())
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
    }
}

// MARK: - LSPD-Farbschema
struct LSPDColors {
    static let primary = Color(hex: "#0066cc")
    static let primaryBright = Color(hex: "#0088ff")
    static let secondary = Color(hex: "#00ff88")
    static let dark = Color(hex: "#0a0e27")
    static let danger = Color(hex: "#ff3333")
    static let warning = Color(hex: "#ffaa00")
    static let info = Color(hex: "#00ddff")
}
