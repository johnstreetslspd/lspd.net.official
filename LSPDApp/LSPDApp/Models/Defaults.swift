import Foundation
import SwiftUI

// MARK: - Standard-Rollen
let defaultRolesData: [LSPDRole] = [
    LSPDRole(id: "role_admin", name: "Admin", color: "#ff3333", icon: "fas fa-crown", priority: 100,
             description: "Vollzugriff auf alle Systeme", isDefault: true,
             permissions: ["users","ranks","employees","citizens","evidence","training","applications","citations","charges","press","requests","admin"]),
    LSPDRole(id: "role_commissioner", name: "Commissioner", color: "#ffaa00", icon: "fas fa-star", priority: 90,
             description: "Oberste Leitung & Aufsicht", isDefault: true,
             permissions: ["users","employees","citizens","evidence","training","applications","press","requests"]),
    LSPDRole(id: "role_leitung", name: "Leitungsebene", color: "#0088ff", icon: "fas fa-user-tie", priority: 70,
             description: "Team-Leitung & Koordination", isDefault: true,
             permissions: ["employees","citizens","evidence","training","ranks","applications","citations","charges","press","requests"]),
    LSPDRole(id: "role_personal", name: "Personalverwaltung", color: "#aa66ff", icon: "fas fa-users-cog", priority: 60,
             description: "Personal- und Nutzerverwaltung", isDefault: true,
             permissions: ["users","ranks","employees","applications","press","requests"]),
    LSPDRole(id: "role_ausbilder", name: "Ausbilder", color: "#00ddff", icon: "fas fa-chalkboard-teacher", priority: 50,
             description: "Schulung & Ausbildung neuer Beamter", isDefault: true,
             permissions: ["training","employees","citizens","evidence","applications","charges","press"]),
    LSPDRole(id: "role_mitarbeiter", name: "Mitarbeiter", color: "#00ff88", icon: "fas fa-id-badge", priority: 30,
             description: "Standard-Beamter im Dienst", isDefault: true,
             permissions: ["citizens","evidence","applications","press"]),
    LSPDRole(id: "role_trainee", name: "Trainee", color: "#b0b8d0", icon: "fas fa-user-graduate", priority: 10,
             description: "Auszubildender mit eingeschränktem Zugriff", isDefault: true,
             permissions: ["citizens"])
]

// MARK: - Standard-Abteilungen
let defaultDepartments: [LSPDDepartment] = [
    LSPDDepartment(id: "dept_patrol", name: "Streifendienst", color: "#0066cc", icon: "fas fa-car", description: "Allgemeiner Streifendienst"),
    LSPDDepartment(id: "dept_detektiv", name: "Kriminalpolizei", color: "#ff3333", icon: "fas fa-search", description: "Ermittlungen & Kriminalfälle"),
    LSPDDepartment(id: "dept_swat", name: "SWAT", color: "#333333", icon: "fas fa-shield-alt", description: "Spezialeinsatzkommando"),
    LSPDDepartment(id: "dept_verkehr", name: "Verkehrspolizei", color: "#ffaa00", icon: "fas fa-traffic-light", description: "Verkehrsüberwachung"),
    LSPDDepartment(id: "dept_ausbildung", name: "Ausbildung", color: "#00ddff", icon: "fas fa-graduation-cap", description: "Nachwuchsausbildung")
]

// MARK: - Alle verfügbaren Berechtigungen
let allFeatures = ["users", "ranks", "employees", "citizens", "evidence", "training", "applications", "citations", "charges", "press", "requests", "admin"]

// MARK: - Farb-Helfer
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Datum-Helfer
func formatISODate(_ iso: String, dateStyle: DateFormatter.Style = .medium, timeStyle: DateFormatter.Style = .short) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = formatter.date(from: iso)
    if date == nil {
        formatter.formatOptions = [.withInternetDateTime]
        date = formatter.date(from: iso)
    }
    guard let parsedDate = date else { return iso }
    let df = DateFormatter()
    df.dateStyle = dateStyle
    df.timeStyle = timeStyle
    df.locale = Locale(identifier: "de_DE")
    return df.string(from: parsedDate)
}

// MARK: - PKZ Generator
func generatePKZ(existing: Set<String>) -> String {
    let chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"
    var result: String
    repeat {
        result = "PKZ-"
        for _ in 0..<8 {
            result += String(chars.randomElement()!)
        }
    } while existing.contains(result)
    return result
}
