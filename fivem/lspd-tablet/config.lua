Config = {}

-- ============================================================
-- URL der LSPD Mitarbeiter-Seite (Login-Seite des Portals)
-- ============================================================
Config.WebsiteUrl = "https://lspd.net/mitarbeiter-portal.html"

-- ============================================================
-- Item-Name (muss in ox_inventory/data/items.lua eingetragen
-- oder über server/main.lua registriert werden – s. README)
-- ============================================================
Config.ItemName = "lspd_tablet"

-- ============================================================
-- Sitzung beim Öffnen zurücksetzen?
--   true  → Jedes Mal zum Login-Formular weiterleiten
--            (empfohlen, wenn mehrere Spieler denselben
--             Browser-Cache nutzen, z.B. auf Testservern)
--   false → Bereits angemeldete Sitzungen bleiben erhalten
--            (Standard für Produktivserver, da NUI-Speicher
--             in FiveM sowieso pro Spieler getrennt ist)
-- ============================================================
Config.ClearSessionOnOpen = false

-- ============================================================
-- Erlaubte Jobs (nur diese Jobs dürfen das Tablet benutzen)
-- Leer lassen oder auf nil setzen um den Job-Check zu deakti-
-- vieren (standalone).
-- ============================================================
Config.AllowedJobs = { "police", "lspd", "sheriff", "bcso" }

-- ============================================================
-- Framework: "qbcore" | "esx" | "standalone"
-- ============================================================
Config.Framework = "qbcore"
