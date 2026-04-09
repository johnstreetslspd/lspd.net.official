import Foundation
import FirebaseFirestore
import Combine

// MARK: - DatabaseService – Firestore-Anbindung
@MainActor
class DatabaseService: ObservableObject {
    static let shared = DatabaseService()

    @Published var users: [LSPDUser] = []
    @Published var jobRanks: [LSPDRank] = []
    @Published var roles: [LSPDRole] = []
    @Published var departments: [LSPDDepartment] = []
    @Published var citizens: [LSPDCitizen] = []
    @Published var evidence: [LSPDEvidence] = []
    @Published var training: [LSPDTraining] = []
    @Published var applications: [LSPDApplication] = []
    @Published var citations: [LSPDCitation] = []
    @Published var charges: [LSPDCharge] = []
    @Published var press: [LSPDPress] = []
    @Published var requests: [LSPDRequest] = []
    @Published var news: [LSPDNews] = []
    @Published var auditLog: [LSPDAuditEntry] = []

    @Published var isConnected = false
    @Published var isLoading = false
    @Published var lastError: String?

    private let db = Firestore.firestore()
    private let docRef: DocumentReference
    private var listener: ListenerRegistration?
    private var autoSyncTimer: Timer?

    init() {
        docRef = db.collection("lspdDatabase").document("shared")
    }

    // MARK: - Verbindung starten
    func startListening() {
        // Vorherigen Listener entfernen, um Ressourcen-Leak zu vermeiden
        listener?.remove()
        listener = nil

        isLoading = true
        // Echtzeit-Listener für automatische Updates
        listener = docRef.addSnapshotListener { [weak self] snapshot, error in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                self.isLoading = false

                if let error = error {
                    self.lastError = error.localizedDescription
                    self.isConnected = false
                    print("❌ Firestore Fehler: \(error.localizedDescription)")
                    return
                }

                guard let data = snapshot?.data() else {
                    print("ℹ️ Keine Daten in Firestore")
                    self.loadDefaults()
                    self.isConnected = true
                    return
                }

                self.parseFirestoreData(data)
                self.isConnected = true
                print("✅ Daten von Firestore geladen")
            }
        }
    }

    // MARK: - Verbindung stoppen
    func stopListening() {
        listener?.remove()
        listener = nil
        autoSyncTimer?.invalidate()
        autoSyncTimer = nil
    }

    // MARK: - Hilfsfunktionen für robuste Typumwandlung
    // Firestore (via JS SDK) kann Ganzzahlen als Int, Int64, Double oder NSNumber liefern
    private func toInt(_ val: Any?) -> Int? {
        guard let val = val else { return nil }
        if let i = val as? Int { return i }
        if let i = val as? Int64 { return Int(i) }
        if let d = val as? Double {
            guard d.truncatingRemainder(dividingBy: 1) == 0,
                  d >= Double(Int.min), d <= Double(Int.max) else { return nil }
            return Int(d)
        }
        if let n = val as? NSNumber { return n.intValue }
        return nil
    }

    private func toDouble(_ val: Any?) -> Double? {
        guard let val = val else { return nil }
        if let d = val as? Double { return d }
        if let i = val as? Int { return Double(i) }
        if let i = val as? Int64 { return Double(i) }
        if let n = val as? NSNumber { return n.doubleValue }
        return nil
    }

    // MARK: - Daten parsen
    private func parseFirestoreData(_ data: [String: Any]) {
        // Users
        if let usersData = data["users"] as? [[String: Any]] {
            users = usersData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let username = dict["username"] as? String,
                      let password = dict["password"] as? String else { return nil }
                return LSPDUser(
                    id: id, username: username, password: password,
                    role: dict["role"] as? String ?? "Mitarbeiter",
                    jobRank: dict["jobRank"] as? String ?? "Officer",
                    status: dict["status"] as? String ?? "Aktiv",
                    created: dict["created"] as? String ?? ISO8601DateFormatter().string(from: Date())
                )
            }
        }

        // Ranks
        if let ranksData = data["jobRanks"] as? [[String: Any]] {
            jobRanks = ranksData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let name = dict["name"] as? String else { return nil }
                return LSPDRank(
                    id: id, name: name,
                    color: dict["color"] as? String ?? "#ffffff",
                    icon: dict["icon"] as? String ?? "fas fa-award",
                    priority: toInt(dict["priority"]) ?? 0,
                    department: dict["department"] as? String ?? "",
                    abbreviation: dict["abbreviation"] as? String ?? "",
                    description: dict["description"] as? String ?? ""
                )
            }
        }

        // Roles
        if let rolesData = data["roles"] as? [[String: Any]] {
            roles = rolesData.compactMap { dict in
                guard let id = dict["id"] as? String,
                      let name = dict["name"] as? String else { return nil }
                return LSPDRole(
                    id: id, name: name,
                    color: dict["color"] as? String ?? "#888888",
                    icon: dict["icon"] as? String ?? "fas fa-user",
                    priority: toInt(dict["priority"]) ?? 0,
                    description: dict["description"] as? String ?? "",
                    isDefault: dict["isDefault"] as? Bool ?? false,
                    permissions: dict["permissions"] as? [String] ?? []
                )
            }
        }
        if roles.isEmpty { roles = defaultRolesData }

        // Departments
        if let deptData = data["departments"] as? [[String: Any]] {
            departments = deptData.compactMap { dict in
                guard let id = dict["id"] as? String,
                      let name = dict["name"] as? String else { return nil }
                return LSPDDepartment(
                    id: id, name: name,
                    color: dict["color"] as? String ?? "#888888",
                    icon: dict["icon"] as? String ?? "fas fa-building",
                    description: dict["description"] as? String ?? ""
                )
            }
        }
        if departments.isEmpty { departments = defaultDepartments }

        // Citizens
        if let citizenData = data["citizens"] as? [[String: Any]] {
            citizens = citizenData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let name = dict["name"] as? String else { return nil }
                return LSPDCitizen(
                    id: id, name: name,
                    pkz: dict["pkz"] as? String ?? "",
                    dateOfBirth: dict["dateOfBirth"] as? String,
                    address: dict["address"] as? String,
                    phone: dict["phone"] as? String,
                    notes: dict["notes"] as? String,
                    wantedLevel: toInt(dict["wantedLevel"]),
                    created: dict["created"] as? String
                )
            }
        }

        // Evidence
        if let evidenceData = data["evidence"] as? [[String: Any]] {
            evidence = evidenceData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let name = dict["name"] as? String else { return nil }
                return LSPDEvidence(
                    id: id,
                    aktenzeichen: dict["aktenzeichen"] as? String,
                    name: name,
                    description: dict["description"] as? String,
                    type: dict["type"] as? String,
                    location: dict["location"] as? String,
                    citationAZ: dict["citationAZ"] as? String,
                    addedBy: dict["addedBy"] as? String,
                    date: dict["date"] as? String,
                    imageUrl: dict["imageUrl"] as? String
                )
            }
        }

        // Training
        if let trainingData = data["training"] as? [[String: Any]] {
            training = trainingData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let title = dict["title"] as? String else { return nil }
                return LSPDTraining(
                    id: id, title: title,
                    creator: dict["creator"] as? String,
                    minRank: dict["minRank"] as? String,
                    date: dict["date"] as? String,
                    time: dict["time"] as? String,
                    googleDocsUrl: dict["googleDocsUrl"] as? String,
                    enrollments: dict["enrollments"] as? [String],
                    description: dict["description"] as? String
                )
            }
        }

        // Applications
        if let appData = data["applications"] as? [[String: Any]] {
            applications = appData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let name = dict["applicantName"] as? String else { return nil }
                return LSPDApplication(
                    id: id, applicantName: name,
                    email: dict["email"] as? String,
                    phone: dict["phone"] as? String,
                    age: dict["age"] as? String,
                    motivation: dict["motivation"] as? String,
                    experience: dict["experience"] as? String,
                    status: dict["status"] as? String ?? "Offen",
                    date: dict["date"] as? String,
                    reviewedBy: dict["reviewedBy"] as? String,
                    reviewNotes: dict["reviewNotes"] as? String,
                    trackingCode: dict["trackingCode"] as? String
                )
            }
        }

        // Citations
        if let citData = data["citations"] as? [[String: Any]] {
            citations = citData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let type = dict["type"] as? String else { return nil }
                return LSPDCitation(
                    id: id,
                    aktenzeichen: dict["aktenzeichen"] as? String,
                    name: dict["name"] as? String,
                    citizenId: toInt(dict["citizenId"]),
                    type: type,
                    status: dict["status"] as? String,
                    description: dict["description"] as? String,
                    officer: dict["officer"] as? String,
                    date: dict["date"] as? String
                )
            }
        }

        // Charges
        if let chargeData = data["charges"] as? [[String: Any]] {
            charges = chargeData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let type = dict["type"] as? String else { return nil }
                return LSPDCharge(
                    id: id,
                    chargeNumber: dict["chargeNumber"] as? String,
                    aktenzeichen: dict["aktenzeichen"] as? String,
                    name: dict["name"] as? String,
                    citizenId: toInt(dict["citizenId"]),
                    type: type,
                    vergehen: dict["vergehen"] as? [String],
                    description: dict["description"] as? String,
                    officer: dict["officer"] as? String,
                    source: dict["source"] as? String,
                    status: dict["status"] as? String,
                    date: dict["date"] as? String
                )
            }
        }

        // Press
        if let pressData = data["press"] as? [[String: Any]] {
            press = pressData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let title = dict["title"] as? String else { return nil }
                return LSPDPress(
                    id: id, title: title,
                    content: dict["content"] as? String ?? "",
                    author: dict["author"] as? String,
                    date: dict["date"] as? String,
                    category: dict["category"] as? String,
                    isPublished: dict["isPublished"] as? Bool
                )
            }
        }

        // Requests
        if let reqData = data["requests"] as? [[String: Any]] {
            requests = reqData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let name = dict["name"] as? String,
                      let subject = dict["subject"] as? String,
                      let message = dict["message"] as? String else { return nil }
                return LSPDRequest(
                    id: id, name: name,
                    email: dict["email"] as? String,
                    subject: subject, message: message,
                    type: dict["type"] as? String,
                    status: dict["status"] as? String,
                    date: dict["date"] as? String,
                    response: dict["response"] as? String,
                    respondedBy: dict["respondedBy"] as? String
                )
            }
        }

        // News
        if let newsData = data["news"] as? [[String: Any]] {
            news = newsData.compactMap { dict in
                guard let id = toInt(dict["id"]),
                      let title = dict["title"] as? String else { return nil }
                return LSPDNews(
                    id: id, title: title,
                    content: dict["content"] as? String ?? "",
                    date: dict["date"] as? String
                )
            }
        }

        // Audit-Log
        if let auditData = data["auditLog"] as? [[String: Any]] {
            auditLog = auditData.compactMap { dict in
                guard let action = dict["action"] as? String,
                      let user = dict["user"] as? String,
                      let timestamp = dict["timestamp"] as? String else { return nil }
                return LSPDAuditEntry(
                    id: dict["id"] as? String ?? UUID().uuidString,
                    action: action,
                    user: user,
                    timestamp: timestamp,
                    details: dict["details"] as? String
                )
            }
        }
    }

    // MARK: - Standardwerte laden
    private func loadDefaults() {
        roles = defaultRolesData
        departments = defaultDepartments
        users = [
            LSPDUser(id: 1, username: "Admin", password: "Admin123!", role: "Admin",
                     jobRank: "Admin", status: "Aktiv", created: ISO8601DateFormatter().string(from: Date()))
        ]
    }

    // MARK: - Berechtigungen
    func getPermissions(for roleName: String) -> [String] {
        if let role = roles.first(where: { $0.name == roleName }) {
            return role.permissions
        }
        return defaultRolesData.first(where: { $0.name == roleName })?.permissions ?? []
    }

    func hasPermission(_ user: LSPDUser?, _ permission: String) -> Bool {
        guard let user = user else { return false }
        return getPermissions(for: user.role).contains(permission)
    }

    // MARK: - Nächste ID
    private func nextId<T: Identifiable>(_ items: [T]) -> Int where T.ID == Int {
        return (items.map(\.id).max() ?? 0) + 1
    }

    // MARK: - Speichern
    func saveToFirestore() async {
        do {
            let data: [String: Any] = [
                "users": users.map { encodeToDictionary($0) },
                "jobRanks": jobRanks.map { encodeToDictionary($0) },
                "roles": roles.map { encodeToDictionary($0) },
                "departments": departments.map { encodeToDictionary($0) },
                "citizens": citizens.map { encodeToDictionary($0) },
                "evidence": evidence.map { encodeToDictionary($0) },
                "training": training.map { encodeToDictionary($0) },
                "applications": applications.map { encodeToDictionary($0) },
                "citations": citations.map { encodeToDictionary($0) },
                "charges": charges.map { encodeToDictionary($0) },
                "press": press.map { encodeToDictionary($0) },
                "requests": requests.map { encodeToDictionary($0) },
                "news": news.map { encodeToDictionary($0) },
                "auditLog": auditLog.map { encodeToDictionary($0) },
                "lastUpdated": ISO8601DateFormatter().string(from: Date())
            ]
            try await docRef.setData(data)
            print("✅ Daten gespeichert")
        } catch {
            lastError = error.localizedDescription
            print("❌ Speicherfehler: \(error.localizedDescription)")
        }
    }

    // MARK: - Codable → Dictionary
    private func encodeToDictionary<T: Encodable>(_ value: T) -> [String: Any] {
        guard let data = try? JSONEncoder().encode(value),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return dict
    }

    // MARK: - CRUD Operationen

    // Bürger
    func addCitizen(_ citizen: LSPDCitizen) async {
        var newCitizen = citizen
        newCitizen.id = nextId(citizens)
        if newCitizen.pkz.isEmpty {
            newCitizen.pkz = generatePKZ(existing: Set(citizens.map(\.pkz)))
        }
        citizens.append(newCitizen)
        await saveToFirestore()
    }

    func updateCitizen(_ citizen: LSPDCitizen) async {
        if let idx = citizens.firstIndex(where: { $0.id == citizen.id }) {
            citizens[idx] = citizen
            await saveToFirestore()
        }
    }

    func deleteCitizen(_ id: Int) async {
        citizens.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Beweise
    func addEvidence(_ item: LSPDEvidence) async {
        var newItem = item
        newItem.id = nextId(evidence)
        if newItem.aktenzeichen == nil || newItem.aktenzeichen!.isEmpty {
            // Format matches website pattern: BM-XXXXXX using last 6 digits of ms timestamp
            let ts = Int(Date().timeIntervalSince1970 * 1000)
            newItem.aktenzeichen = "BM-\(String(ts).suffix(6))"
        }
        evidence.append(newItem)
        await saveToFirestore()
    }

    func deleteEvidence(_ id: Int) async {
        evidence.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Schulungen
    func addTraining(_ item: LSPDTraining) async {
        var newItem = item
        newItem.id = nextId(training)
        training.append(newItem)
        await saveToFirestore()
    }

    func updateTraining(_ item: LSPDTraining) async {
        if let idx = training.firstIndex(where: { $0.id == item.id }) {
            training[idx] = item
            await saveToFirestore()
        }
    }

    func enrollInTraining(trainingId: Int, username: String) async {
        if let idx = training.firstIndex(where: { $0.id == trainingId }) {
            var enrollments = training[idx].enrollments ?? []
            if !enrollments.contains(username) {
                enrollments.append(username)
                training[idx].enrollments = enrollments
                await saveToFirestore()
            }
        }
    }

    func deleteTraining(_ id: Int) async {
        training.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Bewerbungen
    func addApplication(_ item: LSPDApplication) async {
        var newItem = item
        newItem.id = nextId(applications)
        applications.append(newItem)
        await saveToFirestore()
    }

    func updateApplication(_ item: LSPDApplication) async {
        if let idx = applications.firstIndex(where: { $0.id == item.id }) {
            applications[idx] = item
            await saveToFirestore()
        }
    }

    func deleteApplication(_ id: Int) async {
        applications.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Strafakten
    func addCitation(_ item: LSPDCitation) async {
        var newItem = item
        newItem.id = nextId(citations)
        if newItem.aktenzeichen == nil || newItem.aktenzeichen!.isEmpty {
            // Format matches website pattern: CA-XXXXXX using last 6 digits of ms timestamp
            let ts = Int(Date().timeIntervalSince1970 * 1000)
            newItem.aktenzeichen = "CA-\(String(ts).suffix(6))"
        }
        citations.append(newItem)
        await saveToFirestore()
    }

    func updateCitation(_ item: LSPDCitation) async {
        if let idx = citations.firstIndex(where: { $0.id == item.id }) {
            citations[idx] = item
            await saveToFirestore()
        }
    }

    func deleteCitation(_ id: Int) async {
        citations.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Anzeigen
    func addCharge(_ item: LSPDCharge) async {
        var newItem = item
        newItem.id = nextId(charges)
        if newItem.chargeNumber == nil || newItem.chargeNumber!.isEmpty {
            // Format matches website pattern: AZ-XXXXXX using last 6 digits of ms timestamp
            let ts = Int(Date().timeIntervalSince1970 * 1000)
            newItem.chargeNumber = "AZ-\(String(ts).suffix(6))"
        }
        charges.append(newItem)
        await saveToFirestore()
    }

    func updateCharge(_ item: LSPDCharge) async {
        if let idx = charges.firstIndex(where: { $0.id == item.id }) {
            charges[idx] = item
            await saveToFirestore()
        }
    }

    func deleteCharge(_ id: Int) async {
        charges.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Presse
    func addPress(_ item: LSPDPress) async {
        var newItem = item
        newItem.id = nextId(press)
        press.append(newItem)
        await saveToFirestore()
    }

    func updatePress(_ item: LSPDPress) async {
        if let idx = press.firstIndex(where: { $0.id == item.id }) {
            press[idx] = item
            await saveToFirestore()
        }
    }

    func deletePress(_ id: Int) async {
        press.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Anfragen
    func addRequest(_ item: LSPDRequest) async {
        var newItem = item
        newItem.id = nextId(requests)
        requests.append(newItem)
        await saveToFirestore()
    }

    func updateRequest(_ item: LSPDRequest) async {
        if let idx = requests.firstIndex(where: { $0.id == item.id }) {
            requests[idx] = item
            await saveToFirestore()
        }
    }

    func deleteRequest(_ id: Int) async {
        requests.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // News
    func addNews(_ item: LSPDNews) async {
        var newItem = item
        newItem.id = nextId(news)
        news.append(newItem)
        await saveToFirestore()
    }

    func updateNews(_ item: LSPDNews) async {
        if let idx = news.firstIndex(where: { $0.id == item.id }) {
            news[idx] = item
            await saveToFirestore()
        }
    }

    func deleteNews(_ id: Int) async {
        news.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Nutzer
    func addUser(_ user: LSPDUser) async {
        var newUser = user
        newUser.id = nextId(users)
        users.append(newUser)
        await saveToFirestore()
    }

    func updateUser(_ user: LSPDUser) async {
        if let idx = users.firstIndex(where: { $0.id == user.id }) {
            users[idx] = user
            await saveToFirestore()
        }
    }

    func deleteUser(_ id: Int) async {
        users.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Ränge
    func addRank(_ rank: LSPDRank) async {
        var newRank = rank
        newRank.id = nextId(jobRanks)
        jobRanks.append(newRank)
        await saveToFirestore()
    }

    func updateRank(_ rank: LSPDRank) async {
        if let idx = jobRanks.firstIndex(where: { $0.id == rank.id }) {
            jobRanks[idx] = rank
            await saveToFirestore()
        }
    }

    func deleteRank(_ id: Int) async {
        jobRanks.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Rollen
    func addRole(_ role: LSPDRole) async {
        roles.append(role)
        await saveToFirestore()
    }

    func updateRole(_ role: LSPDRole) async {
        if let idx = roles.firstIndex(where: { $0.id == role.id }) {
            roles[idx] = role
            await saveToFirestore()
        }
    }

    func deleteRole(_ id: String) async {
        roles.removeAll { $0.id == id }
        await saveToFirestore()
    }

    // Abteilungen
    func addDepartment(_ dept: LSPDDepartment) async {
        departments.append(dept)
        await saveToFirestore()
    }

    func updateDepartment(_ dept: LSPDDepartment) async {
        if let idx = departments.firstIndex(where: { $0.id == dept.id }) {
            departments[idx] = dept
            await saveToFirestore()
        }
    }

    func deleteDepartment(_ id: String) async {
        departments.removeAll { $0.id == id }
        await saveToFirestore()
    }
}
