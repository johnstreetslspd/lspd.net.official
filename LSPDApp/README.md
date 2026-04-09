# LSPD App – SwiftUI iPhone & iPad App

Native iOS App für das LSPD Portal, gebaut mit SwiftUI und Firebase Firestore.
Läuft auf **iPhone** und **iPad**.

## 📱 Features

### Portal Hub
- Startseite mit Zugang zu Bürger- und Mitarbeiterportal
- Über uns, Karriere, Kontakt Informationen

### 🔒 Mitarbeiter-Portal (Login erforderlich)
- **Dashboard** – Übersicht mit berechtigungsbasierten Karten
- **Nutzer** – Benutzerkonten verwalten (CRUD)
- **Ränge** – Dienstgrade mit Priorität, Abteilung verwalten
- **Bürger** – Bürgerdatenbank mit PKZ, Fahndungsstufe
- **Beweise** – Beweismittel erfassen und verwalten
- **Schulungen** – Schulungen erstellen, einschreiben
- **Bewerbungen** – Bewerbungen prüfen und bearbeiten
- **Strafakten** – Strafakten mit Bürger-Zuordnung
- **Anzeigen** – Anzeigen verwalten mit Schweregrad
- **Fallübersicht** – Alle Fälle (Strafakten + Anzeigen) auf einen Blick
- **Presse** – Nachrichten erstellen und veröffentlichen
- **Sonstiges** – Bürger-Anfragen & Beschwerden beantworten
- **Admin** – Rollen, Abteilungen, System-Info
- **Profil** – Benutzerinfo, Berechtigungen, Abmelden

### 🌐 Bürger-Portal (Öffentlich)
- **Bewerbung** – Online bei der LSPD bewerben mit Tracking-Code
- **Status** – Bewerbungsstatus per Tracking-Code prüfen
- **Anfragen** – Anfragen & Beschwerden einreichen
- **News** – Aktuelle LSPD Nachrichten lesen
- **FAQ** – Häufig gestellte Fragen
- **Kontakt** – Notfallnummern & Kontaktdaten
- **Strafanzeige** – Anzeige gegen eine Person erstatten

## 🔥 Firebase Integration

Die App nutzt **dieselbe Firebase Firestore Datenbank** wie das Web-Portal:
- Echtzeit-Synchronisation via Firestore Snapshot Listener
- Alle Änderungen werden sofort auf Web & App sichtbar
- Gleiche Datenstruktur wie `db.js`

## 🛠 Setup-Anleitung

### Voraussetzungen
- **Xcode 15+** (macOS)
- **iOS 17+** Zielplattform
- Apple Developer Account (für Gerät-Tests)

### 1. Projekt in Xcode öffnen

1. Doppelklicke auf `LSPDApp/LSPDApp.xcodeproj` – das Projekt öffnet sich in Xcode
2. Xcode lädt automatisch die Firebase-Abhängigkeiten herunter (dauert beim ersten Mal einige Minuten)
3. Warte bis die Paket-Auflösung abgeschlossen ist (Fortschritt in der Xcode-Statusleiste)

### 2. Firebase konfigurieren

Die App ist bereits programmatisch mit dem Firebase-Projekt **lspd-roleplay** konfiguriert.
Falls Firestore nicht verbindet, prüfe folgende Schritte:

1. Gehe zur [Firebase Console](https://console.firebase.google.com/)
2. Wähle das Projekt **lspd-roleplay**
3. Falls noch keine iOS-App registriert ist:
   - Klicke auf **App hinzufügen** → **iOS**
   - Bundle ID: `com.lspd.portal`
   - App-Name: `LSPD App`
4. (Optional) Lade die `GoogleService-Info.plist` herunter und ersetze die Datei in `LSPDApp/LSPDApp/`

> ℹ️ Die App verwendet die Firebase-Konfiguration direkt im Code (LSPDApp.swift). Die GoogleService-Info.plist ist als Backup vorhanden.

### 3. Bauen & Starten (⌘R)

1. Wähle oben in Xcode ein Zielgerät:
   - **iPhone Simulator** (z.B. iPhone 15 Pro)
   - **iPad Simulator** (z.B. iPad Pro 13")
   - Oder ein verbundenes Gerät
2. Drücke **⌘R** (Cmd+R) zum Bauen und Starten
3. Die App verbindet sich automatisch mit Firebase

### ⚙️ Häufige Build-Probleme

| Problem | Lösung |
|---------|--------|
| "No such module 'FirebaseCore'" | Xcode → File → Packages → Resolve Package Versions |
| "Missing Package Product FirebaseCore" | 1. Xcode → File → Packages → **Reset Package Caches** 2. Dann **Resolve Package Versions** 3. Falls nötig: `~/Library/Developer/Xcode/DerivedData` und `~/Library/Caches/org.swift.swiftpm` löschen → Xcode neustarten → Projekt öffnen |
| Signing-Fehler | Xcode → Target → Signing & Capabilities → Team auswählen |
| iPad-Simulator zeigt nichts | Oben in Xcode iPad-Simulator als Ziel auswählen |
| Firebase verbindet nicht | iOS-App in Firebase Console registrieren (Bundle ID: `com.lspd.portal`) |

## 📂 Projektstruktur

```
LSPDApp/
├── LSPDApp.xcodeproj/               # ← In Xcode öffnen!
│   ├── project.pbxproj              # Xcode-Projektdatei
│   ├── project.xcworkspace/         # Workspace
│   └── xcshareddata/xcschemes/      # Build-Scheme
└── LSPDApp/
    ├── LSPDApp.swift                # App-Einstiegspunkt (@main)
    ├── ContentView.swift            # Haupt-View (Login/Portal)
    ├── MainTabView.swift            # Tab-Navigation (Dashboard/Bürger/Profil)
    ├── Info.plist                   # App-Konfiguration (iPhone + iPad)
    ├── GoogleService-Info.plist     # Firebase-Konfiguration (Platzhalter!)
    ├── Models/
    │   ├── Models.swift             # Alle Datenmodelle (User, Citizen, etc.)
    │   └── Defaults.swift           # Standard-Rollen, Abteilungen, Helfer
    ├── Services/
    │   └── DatabaseService.swift    # Firebase Firestore Service
    ├── ViewModels/
    │   └── AuthViewModel.swift      # Authentifizierung
    ├── Views/
    │   ├── Auth/
    │   │   └── LoginView.swift
    │   ├── PortalHub/
    │   │   └── PortalHubView.swift
    │   ├── Dashboard/
    │   │   ├── MitarbeiterDashboardView.swift
    │   │   └── BuergerDashboardView.swift
    │   ├── Mitarbeiter/
    │   │   ├── NutzerView.swift
    │   │   ├── RaengeView.swift
    │   │   ├── BuergerListView.swift
    │   │   ├── BeweiseView.swift
    │   │   ├── SchulungenView.swift
    │   │   ├── BewerbungenView.swift
    │   │   ├── StrafaktenView.swift
    │   │   ├── AnzeigenView.swift
    │   │   ├── FalluebersichtView.swift
    │   │   ├── PresseView.swift
    │   │   ├── SonstigesView.swift
    │   │   └── AdminView.swift
    │   ├── Buerger/
    │   │   ├── BuergerBewerbungView.swift
    │   │   ├── BuergerStatusView.swift
    │   │   ├── BuergerAnfragenView.swift
    │   │   ├── BuergerNewsView.swift
    │   │   ├── BuergerFAQView.swift
    │   │   ├── BuergerKontaktView.swift
    │   │   └── BuergerStrafanzeigeView.swift
    │   └── Components/
    │       └── SharedComponents.swift
    └── Assets.xcassets/
        ├── AccentColor.colorset/
        ├── AccentBlue.colorset/
        ├── AccentGreen.colorset/
        └── AppIcon.appiconset/
```

## 📱 Unterstützte Geräte

| Gerät | Unterstützt | Orientierung |
|-------|:-----------:|:------------:|
| iPhone | ✅ | Portrait + Landscape |
| iPad | ✅ | Alle Orientierungen |

## 🔐 Login

Verwende dieselben Zugangsdaten wie im Web-Portal:
- Standard: `Admin` / `Admin123!`

## ⚡ Echtzeit-Sync

Die App verwendet einen Firestore **Snapshot Listener** – alle Änderungen im Web-Portal oder in der App werden **sofort** synchronisiert. Kein manuelles Neuladen nötig!

## 📋 Hinweise

- Die App verwendet **iOS 17+** Features (NavigationStack, LabeledContent)
- Dark Mode ist standardmäßig aktiviert
- Das Farbschema entspricht dem Web-Portal (LSPD Blau/Grün)
- Berechtigungen werden wie im Web-Portal über Rollen gesteuert
- Die App läuft nativ auf iPhone und iPad mit adaptivem Layout
