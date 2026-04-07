# LSPD App – SwiftUI iPhone App

Native iOS App für das LSPD Portal, gebaut mit SwiftUI und Firebase Firestore.

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

### 1. Firebase konfigurieren

1. Gehe zur [Firebase Console](https://console.firebase.google.com/)
2. Wähle das Projekt **lspd-roleplay**
3. Füge eine **iOS-App** hinzu:
   - Bundle ID: `com.lspd.portal` (oder eigene)
   - App-Name: `LSPD App`
4. Lade die `GoogleService-Info.plist` herunter
5. Lege die Datei in `LSPDApp/LSPDApp/` ab

### 2. Projekt in Xcode öffnen

**Option A: Swift Package Manager (empfohlen)**
1. Öffne Xcode → **File → Open** → Wähle den `LSPDApp/` Ordner
2. Xcode erkennt `Package.swift` automatisch
3. Firebase SDK wird automatisch heruntergeladen

**Option B: Xcode-Projekt erstellen**
1. Xcode → **File → New → Project → iOS → App**
2. Name: `LSPDApp`, Interface: SwiftUI, Language: Swift
3. Kopiere alle Dateien aus `LSPDApp/LSPDApp/` in das Projekt
4. Füge Firebase SDK via SPM hinzu:
   - **File → Add Package Dependencies**
   - URL: `https://github.com/firebase/firebase-ios-sdk.git`
   - Wähle: `FirebaseFirestore`

### 3. GoogleService-Info.plist

⚠️ **Wichtig:** Die `GoogleService-Info.plist` muss dem Xcode-Projekt hinzugefügt werden.

Erstelle die Datei mit diesen Firebase-Daten:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>API_KEY</key>
    <string>AIzaSyDAltEFoZPnXFyezoApgGf7FY7bAOFk5oA</string>
    <key>GCM_SENDER_ID</key>
    <string>213624245643</string>
    <key>PROJECT_ID</key>
    <string>lspd-roleplay</string>
    <key>STORAGE_BUCKET</key>
    <string>lspd-roleplay.firebasestorage.app</string>
    <key>GOOGLE_APP_ID</key>
    <string>1:213624245643:ios:DEINE_IOS_APP_ID</string>
    <key>BUNDLE_ID</key>
    <string>com.lspd.portal</string>
    <!-- BUNDLE_ID muss mit der Bundle ID übereinstimmen, die in Schritt 3 bei Firebase registriert wurde -->
</dict>
</plist>
```

> Ersetze `DEINE_IOS_APP_ID` mit der tatsächlichen iOS App-ID aus der Firebase Console.

### 4. Bauen & Starten

1. Wähle ein iOS-Simulator oder verbundenes iPhone
2. Drücke **⌘R** zum Bauen und Starten
3. Die App verbindet sich automatisch mit Firebase

## 📂 Projektstruktur

```
LSPDApp/
├── Package.swift                    # Swift Package Manager Config
└── LSPDApp/
    ├── LSPDApp.swift                # App-Einstiegspunkt
    ├── ContentView.swift            # Haupt-View (Login/Portal)
    ├── MainTabView.swift            # Tab-Navigation (Dashboard/Bürger/Profil)
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
