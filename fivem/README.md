# LSPD Portal Sync – FiveM Resource

Dieses FiveM-Resource synchronisiert Charakterdaten aus der FiveM-Serverdatenbank automatisch mit dem **LSPD Web-Portal** (Firebase Firestore). Alle neu angelegten Spielercharaktere werden so automatisch als Bürger im Portal angelegt und aktuell gehalten.

---

## Unterstützte Frameworks

| Framework    | Status          |
|-------------|-----------------|
| **QBCore**  | ✅ Vollständig   |
| **ESX**     | ✅ Vollständig   |
| Standalone  | ✅ Konfigurierbar |

---

## Voraussetzungen

- FiveM-Server mit MySQL-Datenbank
- Eine der folgenden MySQL-Bibliotheken:
  - [`oxmysql`](https://github.com/overextended/oxmysql) *(empfohlen)*
  - [`mysql-async`](https://github.com/brouznouf/fivem-mysql-async)
- Zugang zur Firebase-Konfiguration des LSPD-Portals

---

## Installation

1. **Resource kopieren:** Den Ordner `lspd-portal-sync` (= dieser Ordner) in das `resources/`-Verzeichnis deines FiveM-Servers kopieren:
   ```
   resources/
   └── lspd-portal-sync/
       ├── fxmanifest.lua
       ├── config.lua
       └── server/
           ├── firebase.lua
           └── main.lua
   ```

2. **`server.cfg` anpassen:** Resource zur Startreihenfolge hinzufügen:
   ```cfg
   ensure lspd-portal-sync
   ```
   > ⚠️ Das Resource muss **nach** oxmysql/mysql-async gestartet werden.

3. **Konfiguration anpassen:** `config.lua` öffnen und alle Einstellungen auf dein System anpassen (siehe unten).

---

## Konfiguration (`config.lua`)

### Firebase-Verbindung
```lua
Config.Firebase = {
    ProjectId  = "dein-firebase-projekt-id",
    ApiKey     = "dein-firebase-api-key",
    Database   = "(default)",
    Collection = "lspdDatabase",
    Document   = "shared",
}
```
> Firebase-Zugangsdaten aus deiner `firebase-config.js` übernehmen.

### Framework
```lua
Config.Framework = "qbcore"  -- "qbcore", "esx" oder "standalone"
```

### Sync-Verhalten
```lua
Config.Sync = {
    SyncOnStart          = true,   -- Sync beim Server-Start
    AutoSyncInterval     = 300,    -- Auto-Sync alle 5 Minuten (Sekunden)
    AutoCreateCitizens   = true,   -- Neue Bürger automatisch anlegen
    AutoUpdateCitizens   = true,   -- Bestehende Bürger aktualisieren
    SyncOnCharacterLoad  = true,   -- Sync wenn Charakter geladen wird
    MaxCitizensPerBatch  = 0,      -- 0 = unbegrenzt
}
```

### Feld-Mapping
Steuert, welche Felder aus FiveM ins Portal übertragen werden:
```lua
Config.FieldMapping = {
    SyncName        = true,
    SyncPhone       = true,
    SyncAddress     = true,
    SyncDateOfBirth = true,
    SyncAge         = true,
    SyncGender      = true,
    SyncFivemId     = true,
    SyncSteamId     = true,
}
```

---

## Citizen-Datenfelder

Nach der Synchronisation enthält jeder Bürger im Portal folgende Felder:

| Feld            | Beschreibung                          | Beispiel                    |
|----------------|---------------------------------------|-----------------------------|
| `id`            | Interne Portal-ID                     | `1710000000000`             |
| `name`          | Vollständiger Name                    | `"Max Mustermann"`          |
| `phone`         | Telefonnummer                         | `"555-1234"`                |
| `address`       | Adresse                               | `"Vinewood Blvd 1"`         |
| `status`        | Bürgerstatus                          | `"Aktiv"` / `"Inaktiv"`     |
| `dateOfBirth`   | Geburtsdatum                          | `"15.01.1990"`              |
| `age`           | Alter (automatisch berechnet)         | `34`                        |
| `gender`        | Geschlecht                            | `"Männlich"` / `"Weiblich"` |
| `fivemId`       | FiveM Charakter-ID (citizenid)        | `"char_ABC123"`             |
| `steamId`       | Steam/License Identifier              | `"steam:110000112345678"`   |
| `syncSource`    | Synchronisationsquelle                | `"fivem"` / `"manual"`      |
| `lastFivemSync` | Zeitstempel des letzten FiveM-Syncs   | `"2024-01-15T12:00:00Z"`    |

---

## Server-Befehle

| Befehl        | Beschreibung                                      |
|---------------|---------------------------------------------------|
| `lspdsync`    | Manuellen Vollsync aus der Server-Konsole starten |

---

## Exports (für andere Resources)

```lua
-- Vollständigen Sync manuell auslösen
exports['lspd-portal-sync']:TriggerSync()

-- Einzelnen Charakter synchronisieren
exports['lspd-portal-sync']:SyncCharacter({
    name        = "Max Mustermann",
    phone       = "555-1234",
    dateOfBirth = "15.01.1990",
    age         = 34,
    gender      = "Männlich",
    fivemId     = "char_ABC123",
    steamId     = "steam:110000112345678",
    address     = "",
})
```

---

## Datenoberflächenübersicht

```
FiveM Server (MySQL)
        │
        │  1. Charakterdaten lesen (oxmysql/mysql-async)
        ▼
  server/main.lua
        │
        │  2. Daten normalisieren und mergen
        ▼
  server/firebase.lua
        │
        │  3. Firestore REST API (PATCH /citizens)
        ▼
Firebase Firestore
        │
        │  4. Automatische Live-Aktualisierung (5s)
        ▼
  LSPD Web-Portal
  (Bürgerverwaltung)
```

---

## Fehlerbehebung

**Keine Bürger werden synchronisiert:**
- `Config.Debug = true` setzen und Server-Konsole prüfen
- Sicherstellen, dass oxmysql/mysql-async gestartet ist **bevor** dieses Resource startet
- Firebase API-Key und Projekt-ID überprüfen

**HTTP 400/403-Fehler:**
- Firebase API-Key prüfen (muss dem Projekt entsprechen)
- Sicherstellen, dass Firestore-Lese/-Schreibregeln den API-Key-Zugriff erlauben

> ⚠️ **Sicherheitshinweis:** Der Firebase Web-API-Key ist clientseitig sichtbar und entspricht dem, der bereits in `firebase-config.js` des Portals verwendet wird. Schränke ihn in der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) auf die erlaubten HTTP-Referrer/IPs ein und konfiguriere Firestore Security Rules, um unbefugten Schreibzugriff zu unterbinden.

**Falsches Framework:**
- `Config.Framework` auf `"qbcore"`, `"esx"` oder `"standalone"` setzen
- Tabellen-/Spaltennamen in `Config.Database` prüfen
