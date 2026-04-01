-- ============================================================
-- config.lua – LSPD Portal Sync Konfiguration
-- Alle Einstellungen zentral konfigurierbar
-- ============================================================

Config = {}

-- ============================================================
-- Firebase / Firestore Verbindung
-- ============================================================
Config.Firebase = {
    -- Firebase Projekt-ID (aus firebase-config.js)
    ProjectId  = "lspd-roleplay",

    -- Firebase Web-API-Key (aus firebase-config.js)
    ApiKey     = "AIzaSyDAltEFoZPnXFyezoApgGf7FY7bAOFk5oA",

    -- Firestore Datenbank-Name (Standard: "(default)")
    Database   = "(default)",

    -- Firestore Collection und Dokument-Name
    Collection = "lspdDatabase",
    Document   = "shared",
}

-- ============================================================
-- Framework-Einstellungen
-- Unterstützte Werte: "qbcore", "esx", "standalone"
-- ============================================================
Config.Framework = "qbcore"

-- ============================================================
-- Datenbank-Einstellungen
-- Tabellen- und Spaltennamen für die jeweiligen Frameworks
-- ============================================================
Config.Database = {

    -- MySQL-Bibliothek: "oxmysql" oder "mysql-async"
    Library = "oxmysql",

    -- QBCore Einstellungen
    QBCore = {
        -- Tabelle mit Spieler-/Charakterdaten
        Table          = "players",
        -- Spalte mit der FiveM-Lizenz (z.B. "steam:..." oder "license:...")
        LicenseColumn  = "license",
        -- Spalte mit der internen Charakter-ID
        CitizenIdColumn = "citizenid",
        -- Spalte mit dem JSON-Charakterprofil (charinfo)
        -- Erwartet: { firstname, lastname, birthdate, gender, nationality, phone }
        CharInfoColumn = "charinfo",
        -- Spalte mit Metadaten (für Telefonnummer, falls in charinfo nicht vorhanden)
        MetadataColumn = "metadata",
    },

    -- ESX Einstellungen
    ESX = {
        -- Tabelle mit Spieler-/Charakterdaten
        Table           = "users",
        -- Spalte mit dem Spieler-Identifier (z.B. "steam:..." oder "license:...")
        IdentifierColumn = "identifier",
        -- Vorname-Spalte
        FirstNameColumn  = "firstname",
        -- Nachname-Spalte
        LastNameColumn   = "lastname",
        -- Geburtsdatum-Spalte (Format: TT-MM-JJJJ oder JJJJ-MM-TT)
        DateOfBirthColumn = "dateofbirth",
        -- Geschlecht-Spalte (0 = Männlich, 1 = Weiblich)
        SexColumn        = "sex",
        -- Telefonnummer-Spalte (optional, "" = nicht vorhanden)
        PhoneColumn      = "phone_number",
    },

    -- Standalone / Eigenes Framework
    Standalone = {
        -- Tabelle mit Charakterdaten
        Table           = "characters",
        -- Lizenz-/Identifier-Spalte
        LicenseColumn   = "license",
        -- Interne Charakter-ID
        CharIdColumn    = "id",
        -- Vorname-Spalte
        FirstNameColumn = "firstname",
        -- Nachname-Spalte
        LastNameColumn  = "lastname",
        -- Telefonnummer-Spalte (optional, "" = nicht vorhanden)
        PhoneColumn     = "phone",
        -- Geburtsdatum-Spalte
        DateOfBirthColumn = "dateofbirth",
        -- Alter-Spalte (optional, "" = wird aus Geburtsdatum berechnet)
        AgeColumn       = "age",
        -- Geschlecht-Spalte (optional, "" = nicht vorhanden)
        GenderColumn    = "gender",
        -- Adresse-Spalte (optional, "" = nicht vorhanden)
        AddressColumn   = "address",
    },
}

-- ============================================================
-- Sync-Einstellungen
-- ============================================================
Config.Sync = {
    -- Vollständige Synchronisation beim Server-Start durchführen
    SyncOnStart = true,

    -- Automatisches Sync-Intervall in Sekunden (0 = deaktiviert)
    -- Empfohlen: 300 (alle 5 Minuten), 0 = nur manuell / bei Events
    AutoSyncInterval = 300,

    -- Neuen Bürger automatisch im Portal anlegen, wenn er in der
    -- FiveM-Datenbank gefunden wird, aber noch nicht im Portal existiert
    AutoCreateCitizens = true,

    -- Bestehende Bürger im Portal aktualisieren, wenn sich Daten geändert haben
    -- (Matching erfolgt via fivemId oder name)
    AutoUpdateCitizens = true,

    -- Bürger synchronisieren, wenn ein Charakter im Spiel geladen wird
    SyncOnCharacterLoad = true,

    -- Bürger synchronisieren, wenn sich ein Spieler abmeldet (Daten schreiben)
    SyncOnPlayerDrop = false,

    -- Maximale Anzahl Bürger pro Sync-Durchlauf (0 = unbegrenzt)
    MaxCitizensPerBatch = 0,
}

-- ============================================================
-- Feld-Mapping: FiveM → Portal
-- Steuert, welche Felder aus FiveM ins Portal übertragen werden
-- ============================================================
Config.FieldMapping = {
    -- Vollständiger Name (Vorname + Nachname)
    SyncName        = true,
    -- Telefonnummer
    SyncPhone       = true,
    -- Adresse
    SyncAddress     = true,
    -- Geburtsdatum
    SyncDateOfBirth = true,
    -- Alter (berechnet aus Geburtsdatum oder direkt aus DB)
    SyncAge         = true,
    -- Geschlecht
    SyncGender      = true,
    -- FiveM Character-ID
    SyncFivemId     = true,
    -- Steam/License Identifier
    SyncSteamId     = true,
}

-- ============================================================
-- Status-Mapping: FiveM Spieler-Status → Portal-Bürgerstatus
-- ============================================================
Config.StatusMapping = {
    -- Standard-Status für neu angelegte Bürger
    Default = "Aktiv",
    -- Status für gebannte Spieler (falls IsBanned erkannt wird)
    Banned  = "Inaktiv",
}

-- ============================================================
-- Geschlechts-Mapping
-- ============================================================
Config.GenderMapping = {
    -- QBCore: 0 = Männlich, 1 = Weiblich
    [0] = "Männlich",
    [1] = "Weiblich",
    -- ESX-kompatibel (ebenfalls 0/1 oder "m"/"f")
    ["m"] = "Männlich",
    ["f"] = "Weiblich",
    -- Fallback
    ["Männlich"] = "Männlich",
    ["Weiblich"]  = "Weiblich",
    ["male"]   = "Männlich",
    ["female"] = "Weiblich",
}

-- ============================================================
-- Logging / Debug
-- ============================================================
Config.Debug = false   -- Detaillierte Debug-Ausgaben in der Server-Konsole

-- Präfix für alle Konsolen-Ausgaben dieses Resources
Config.LogPrefix = "^3[LSPD-Sync]^7"
