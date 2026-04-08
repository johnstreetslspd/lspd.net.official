import Foundation

// MARK: - Benutzer (User)
struct LSPDUser: Identifiable, Codable, Hashable {
    var id: Int
    var username: String
    var password: String
    var role: String
    var jobRank: String
    var status: String
    var created: String

    enum CodingKeys: String, CodingKey {
        case id, username, password, role, jobRank, status, created
    }
}

// MARK: - Rolle (Role)
struct LSPDRole: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var color: String
    var icon: String
    var priority: Int
    var description: String
    var isDefault: Bool
    var permissions: [String]

    enum CodingKeys: String, CodingKey {
        case id, name, color, icon, priority, description, isDefault, permissions
    }
}

// MARK: - Rang (Rank / JobRank)
struct LSPDRank: Identifiable, Codable, Hashable {
    var id: Int
    var name: String
    var color: String
    var icon: String
    var priority: Int
    var department: String
    var abbreviation: String
    var description: String

    enum CodingKeys: String, CodingKey {
        case id, name, color, icon, priority, department, abbreviation, description
    }
}

// MARK: - Abteilung (Department)
struct LSPDDepartment: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var color: String
    var icon: String
    var description: String

    enum CodingKeys: String, CodingKey {
        case id, name, color, icon, description
    }
}

// MARK: - Bürger (Citizen)
struct LSPDCitizen: Identifiable, Codable, Hashable {
    var id: Int
    var name: String
    var pkz: String
    var dateOfBirth: String?
    var address: String?
    var phone: String?
    var notes: String?
    var wantedLevel: Int?
    var created: String?

    enum CodingKeys: String, CodingKey {
        case id, name, pkz, dateOfBirth, address, phone, notes, wantedLevel, created
    }
}

// MARK: - Beweis (Evidence)
struct LSPDEvidence: Identifiable, Codable, Hashable {
    var id: Int
    var title: String
    var description: String
    var type: String?
    var caseNumber: String?
    var addedBy: String?
    var date: String?
    var imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, type, caseNumber, addedBy, date, imageUrl
    }
}

// MARK: - Schulung (Training)
struct LSPDTraining: Identifiable, Codable, Hashable {
    var id: Int
    var title: String
    var creator: String?
    var minRank: String?
    var date: String?
    var time: String?
    var googleDocsUrl: String?
    var enrollments: [String]?
    var description: String?

    enum CodingKeys: String, CodingKey {
        case id, title, creator, minRank, date, time, googleDocsUrl, enrollments, description
    }
}

// MARK: - Bewerbung (Application)
struct LSPDApplication: Identifiable, Codable, Hashable {
    var id: Int
    var applicantName: String
    var email: String?
    var phone: String?
    var age: String?
    var motivation: String?
    var experience: String?
    var status: String
    var date: String?
    var reviewedBy: String?
    var reviewNotes: String?
    var trackingCode: String?

    enum CodingKeys: String, CodingKey {
        case id, applicantName, email, phone, age, motivation, experience
        case status, date, reviewedBy, reviewNotes, trackingCode
    }
}

// MARK: - Strafakte (Citation / Criminal Record)
struct LSPDCitation: Identifiable, Codable, Hashable {
    var id: Int
    var citizenId: Int?
    var citizenName: String?
    var offense: String
    var details: String?
    var fine: Double?
    var date: String?
    var officer: String?
    var status: String?

    enum CodingKeys: String, CodingKey {
        case id, citizenId, citizenName, offense, details, fine, date, officer, status
    }
}

// MARK: - Anzeige (Charge)
struct LSPDCharge: Identifiable, Codable, Hashable {
    var id: Int
    var citizenId: Int?
    var citizenName: String?
    var charge: String
    var description: String?
    var severity: String?
    var date: String?
    var filedBy: String?
    var status: String?

    enum CodingKeys: String, CodingKey {
        case id, citizenId, citizenName, charge, description, severity, date, filedBy, status
    }
}

// MARK: - Pressenachricht (Press)
struct LSPDPress: Identifiable, Codable, Hashable {
    var id: Int
    var title: String
    var content: String
    var author: String?
    var date: String?
    var category: String?
    var isPublished: Bool?

    enum CodingKeys: String, CodingKey {
        case id, title, content, author, date, category, isPublished
    }
}

// MARK: - Anfrage (Request)
struct LSPDRequest: Identifiable, Codable, Hashable {
    var id: Int
    var name: String
    var email: String?
    var subject: String
    var message: String
    var type: String?
    var status: String?
    var date: String?
    var response: String?
    var respondedBy: String?

    enum CodingKeys: String, CodingKey {
        case id, name, email, subject, message, type, status, date, response, respondedBy
    }
}

// MARK: - Nachricht (News)
struct LSPDNews: Identifiable, Codable, Hashable {
    var id: Int
    var title: String
    var content: String
    var date: String?

    enum CodingKeys: String, CodingKey {
        case id, title, content, date
    }
}

// MARK: - Audit-Log Eintrag
struct LSPDAuditEntry: Identifiable, Codable, Hashable {
    var id: String = UUID().uuidString
    var action: String
    var user: String
    var timestamp: String
    var details: String?

    enum CodingKeys: String, CodingKey {
        case id, action, user, timestamp, details
    }
}

// MARK: - Gesamte Datenbank
struct LSPDDatabase: Codable {
    var users: [LSPDUser]
    var jobRanks: [LSPDRank]
    var roles: [LSPDRole]?
    var departments: [LSPDDepartment]?
    var employees: [LSPDUser]?
    var citizens: [LSPDCitizen]
    var evidence: [LSPDEvidence]
    var training: [LSPDTraining]
    var applications: [LSPDApplication]
    var citations: [LSPDCitation]
    var charges: [LSPDCharge]
    var press: [LSPDPress]
    var auditLog: [LSPDAuditEntry]?
    var requests: [LSPDRequest]
    var news: [LSPDNews]
    var customRoles: [String]?
    var rolePermissions: [String: [String]]?
    var lastUpdated: String?

    enum CodingKeys: String, CodingKey {
        case users, jobRanks, roles, departments, employees, citizens
        case evidence, training, applications, citations, charges, press
        case auditLog, requests, news, customRoles, rolePermissions, lastUpdated
    }
}
