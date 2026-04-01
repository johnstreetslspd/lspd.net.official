-- ============================================================
-- server/main.lua – LSPD Portal Sync: Hauptlogik
-- Liest Charakterdaten aus der FiveM-Datenbank und
-- synchronisiert sie mit dem LSPD Web-Portal via Firestore.
-- ============================================================

-- ============================================================
-- Hilfsfunktionen
-- ============================================================

local function log(msg)
    print(Config.LogPrefix .. " " .. msg)
end

local function debug(msg)
    if Config.Debug then log(msg) end
end

--- Berechnet das Alter aus einem Geburtsdatum-String.
--- Unterstützte Formate: "TT-MM-JJJJ", "JJJJ-MM-TT", "TT/MM/JJJJ"
--- @param dob string  Geburtsdatum-String
--- @return number|nil Alter in Jahren oder nil
local function calculateAge(dob)
    if not dob or dob == "" then return nil end

    local day, month, year

    -- Format: TT-MM-JJJJ oder TT/MM/JJJJ
    day, month, year = dob:match("^(%d%d?)[%-/](%d%d?)[%-/](%d%d%d%d)$")
    if not day then
        -- Format: JJJJ-MM-TT
        year, month, day = dob:match("^(%d%d%d%d)[%-/](%d%d?)[%-/](%d%d?)$")
    end

    if not year then return nil end

    day, month, year = tonumber(day), tonumber(month), tonumber(year)
    if not (day and month and year) then return nil end

    -- Aktuelles Datum (grob, ohne Zeitzone-Overhead)
    -- os.time() gibt UTC-Unix-Timestamp zurück
    local now  = os.date("*t", os.time())
    local age  = now.year - year
    if now.month < month or (now.month == month and now.day < day) then
        age = age - 1
    end
    return math.max(0, age)
end

--- Normalisiert ein Geburtsdatum auf das Format "TT.MM.JJJJ"
--- @param dob string
--- @return string
local function normalizeDateOfBirth(dob)
    if not dob or dob == "" then return "" end

    local day, month, year

    day, month, year = dob:match("^(%d%d?)[%-/](%d%d?)[%-/](%d%d%d%d)$")
    if not day then
        year, month, day = dob:match("^(%d%d%d%d)[%-/](%d%d?)[%-/](%d%d?)$")
    end

    if day and month and year then
        return ("%02d.%02d.%04d"):format(tonumber(day), tonumber(month), tonumber(year))
    end

    return dob
end

--- Mappt ein Geschlechts-Wert aus FiveM auf den Portal-String.
--- @param rawGender any
--- @return string
local function mapGender(rawGender)
    if rawGender == nil then return "" end
    local mapped = Config.GenderMapping[rawGender]
    if mapped then return mapped end
    -- Fallback: Zahl 0/1 als Männlich/Weiblich
    if type(rawGender) == "number" then
        return rawGender == 0 and "Männlich" or "Weiblich"
    end
    return tostring(rawGender)
end

-- ============================================================
-- Datenbank-Abfragen (Framework-spezifisch)
-- ============================================================

--- Führt eine SQL-Abfrage mit der konfigurierten MySQL-Bibliothek aus.
--- @param query  string
--- @param params table
--- @param callback function(rows)
local function dbFetch(query, params, callback)
    local lib = Config.Database.Library
    if lib == "oxmysql" then
        exports['oxmysql']:execute(query, params, callback)
    elseif lib == "mysql-async" then
        MySQL.Async.fetchAll(query, params, callback)
    else
        log("❌ Unbekannte Datenbank-Bibliothek: " .. tostring(lib))
        callback({})
    end
end

--- Liest alle Charaktere aus der Datenbank je nach Framework.
--- @param callback function(characters) – Array mit normierten Charakter-Objekten
local function fetchCharacters(callback)
    local fw = Config.Framework

    -- ----------------------------------------------------------
    -- QBCore
    -- ----------------------------------------------------------
    if fw == "qbcore" then
        local cfg = Config.Database.QBCore
        local query = ("SELECT %s, %s, %s, %s FROM %s"):format(
            cfg.LicenseColumn, cfg.CitizenIdColumn, cfg.CharInfoColumn, cfg.MetadataColumn, cfg.Table
        )
        dbFetch(query, {}, function(rows)
            local characters = {}
            for _, row in ipairs(rows or {}) do
                local charInfo = {}
                local metadata = {}

                local ok, decoded = pcall(json.decode, row[cfg.CharInfoColumn] or "{}")
                if ok and decoded then charInfo = decoded end

                local ok2, decoded2 = pcall(json.decode, row[cfg.MetadataColumn] or "{}")
                if ok2 and decoded2 then metadata = decoded2 end

                local firstName  = charInfo.firstname  or charInfo.first_name  or ""
                local lastName   = charInfo.lastname   or charInfo.last_name   or ""
                local fullName   = (firstName .. " " .. lastName):match("^%s*(.-)%s*$")
                local dob        = charInfo.birthdate  or charInfo.dateofbirth or ""
                local phone      = charInfo.phone      or metadata.phoneNumber or metadata.phone_number or ""
                local rawGender  = charInfo.gender

                if fullName ~= "" then
                    table.insert(characters, {
                        fivemId     = tostring(row[cfg.CitizenIdColumn] or ""),
                        steamId     = tostring(row[cfg.LicenseColumn]   or ""),
                        name        = fullName,
                        phone       = tostring(phone),
                        dateOfBirth = normalizeDateOfBirth(dob),
                        age         = calculateAge(dob),
                        gender      = mapGender(rawGender),
                        address     = "",
                    })
                end
            end
            debug("QBCore: " .. #characters .. " Charaktere geladen")
            callback(characters)
        end)

    -- ----------------------------------------------------------
    -- ESX
    -- ----------------------------------------------------------
    elseif fw == "esx" then
        local cfg = Config.Database.ESX
        local phoneCol = (cfg.PhoneColumn ~= "" and cfg.PhoneColumn) or "NULL"
        local query = ("SELECT %s, %s, %s, %s, %s, %s FROM %s"):format(
            cfg.IdentifierColumn,
            cfg.FirstNameColumn,
            cfg.LastNameColumn,
            cfg.DateOfBirthColumn,
            cfg.SexColumn,
            phoneCol,
            cfg.Table
        )
        dbFetch(query, {}, function(rows)
            local characters = {}
            for _, row in ipairs(rows or {}) do
                local firstName = row[cfg.FirstNameColumn]  or ""
                local lastName  = row[cfg.LastNameColumn]   or ""
                local fullName  = (firstName .. " " .. lastName):match("^%s*(.-)%s*$")
                local dob       = row[cfg.DateOfBirthColumn] or ""
                local phone     = (cfg.PhoneColumn ~= "" and row[cfg.PhoneColumn]) or ""
                local rawGender = row[cfg.SexColumn]

                if fullName ~= "" then
                    table.insert(characters, {
                        fivemId     = "",
                        steamId     = tostring(row[cfg.IdentifierColumn] or ""),
                        name        = fullName,
                        phone       = tostring(phone),
                        dateOfBirth = normalizeDateOfBirth(dob),
                        age         = calculateAge(dob),
                        gender      = mapGender(rawGender),
                        address     = "",
                    })
                end
            end
            debug("ESX: " .. #characters .. " Charaktere geladen")
            callback(characters)
        end)

    -- ----------------------------------------------------------
    -- Standalone / Eigenes Framework
    -- ----------------------------------------------------------
    elseif fw == "standalone" then
        local cfg = Config.Database.Standalone

        -- Spalten dynamisch zusammenstellen
        local cols = { cfg.LicenseColumn, cfg.CharIdColumn, cfg.FirstNameColumn, cfg.LastNameColumn }
        if cfg.DateOfBirthColumn ~= "" then table.insert(cols, cfg.DateOfBirthColumn) end
        if cfg.AgeColumn ~= ""         then table.insert(cols, cfg.AgeColumn) end
        if cfg.GenderColumn ~= ""      then table.insert(cols, cfg.GenderColumn) end
        if cfg.PhoneColumn ~= ""       then table.insert(cols, cfg.PhoneColumn) end
        if cfg.AddressColumn ~= ""     then table.insert(cols, cfg.AddressColumn) end

        local query = ("SELECT %s FROM %s"):format(table.concat(cols, ", "), cfg.Table)
        dbFetch(query, {}, function(rows)
            local characters = {}
            for _, row in ipairs(rows or {}) do
                local firstName = row[cfg.FirstNameColumn] or ""
                local lastName  = row[cfg.LastNameColumn]  or ""
                local fullName  = (firstName .. " " .. lastName):match("^%s*(.-)%s*$")
                local dob       = (cfg.DateOfBirthColumn ~= "" and row[cfg.DateOfBirthColumn]) or ""
                local age       = (cfg.AgeColumn ~= "" and row[cfg.AgeColumn]) or calculateAge(dob)
                local phone     = (cfg.PhoneColumn ~= "" and row[cfg.PhoneColumn]) or ""
                local gender    = (cfg.GenderColumn ~= "" and mapGender(row[cfg.GenderColumn])) or ""
                local address   = (cfg.AddressColumn ~= "" and row[cfg.AddressColumn]) or ""

                if fullName ~= "" then
                    table.insert(characters, {
                        fivemId     = tostring(row[cfg.CharIdColumn]  or ""),
                        steamId     = tostring(row[cfg.LicenseColumn] or ""),
                        name        = fullName,
                        phone       = tostring(phone),
                        dateOfBirth = normalizeDateOfBirth(dob),
                        age         = (type(age) == "number") and age or tonumber(age),
                        gender      = gender,
                        address     = tostring(address),
                    })
                end
            end
            debug("Standalone: " .. #characters .. " Charaktere geladen")
            callback(characters)
        end)

    else
        log("❌ Unbekanntes Framework: " .. tostring(fw))
        callback({})
    end
end

-- ============================================================
-- Sync-Logik: FiveM DB ↔ Firestore
-- ============================================================

--- Führt einen vollständigen Sync-Durchlauf durch:
--- 1. Liest alle Charaktere aus der FiveM-DB
--- 2. Liest die aktuelle citizens-Liste aus Firestore
--- 3. Fügt neue Bürger hinzu / aktualisiert bestehende
--- 4. Schreibt die aktualisierte Liste zurück nach Firestore
local function performSync()
    debug("🔄 Starte Synchronisation...")

    fetchCharacters(function(fivemChars)
        if #fivemChars == 0 then
            log("⚠️ Keine Charaktere in der FiveM-Datenbank gefunden")
            return
        end
        debug("FiveM-Datenbank: " .. #fivemChars .. " Charaktere gefunden")

        Firebase.GetDocument(function(success, portalData)
            if not success then
                log("❌ Firestore-Dokument konnte nicht geladen werden")
                return
            end

            local portalCitizens = portalData.citizens or {}
            local created, updated = 0, 0

            -- --------------------------------------------------
            -- Bürger aus FiveM in Portal-Liste einpflegen
            -- --------------------------------------------------
            local limit = Config.Sync.MaxCitizensPerBatch
            local count = 0

            for _, char in ipairs(fivemChars) do
                if limit > 0 and count >= limit then break end
                count = count + 1

                -- Suche bestehenden Bürger anhand fivemId oder Name
                local existing = nil
                for _, c in ipairs(portalCitizens) do
                    if char.fivemId ~= "" and c.fivemId == char.fivemId then
                        existing = c
                        break
                    end
                end
                if not existing then
                    for _, c in ipairs(portalCitizens) do
                        if c.name == char.name then
                            existing = c
                            break
                        end
                    end
                end

                if existing then
                    -- Bestehenden Bürger aktualisieren (falls aktiviert)
                    if Config.Sync.AutoUpdateCitizens then
                        if Config.FieldMapping.SyncName        then existing.name        = char.name end
                        if Config.FieldMapping.SyncPhone       then existing.phone       = char.phone end
                        if Config.FieldMapping.SyncAddress     and char.address ~= "" then existing.address = char.address end
                        if Config.FieldMapping.SyncDateOfBirth then existing.dateOfBirth = char.dateOfBirth end
                        if Config.FieldMapping.SyncAge         then existing.age         = char.age end
                        if Config.FieldMapping.SyncGender      then existing.gender      = char.gender end
                        if Config.FieldMapping.SyncFivemId     then existing.fivemId     = char.fivemId end
                        if Config.FieldMapping.SyncSteamId     then existing.steamId     = char.steamId end
                        existing.lastFivemSync = os.date("!%Y-%m-%dT%H:%M:%SZ")
                        existing.syncSource    = "fivem"
                        updated = updated + 1
                    end
                else
                    -- Neuen Bürger anlegen (falls aktiviert)
                    if Config.Sync.AutoCreateCitizens then
                        local newCitizen = {
                            id          = os.time() * 1000 + math.random(0, 999),
                            name        = char.name,
                            phone       = char.phone,
                            address     = char.address,
                            status      = Config.StatusMapping.Default,
                            dateOfBirth = char.dateOfBirth,
                            age         = char.age,
                            gender      = char.gender,
                            fivemId     = char.fivemId,
                            steamId     = char.steamId,
                            syncSource  = "fivem",
                            lastFivemSync = os.date("!%Y-%m-%dT%H:%M:%SZ"),
                            notes       = {},
                        }
                        table.insert(portalCitizens, newCitizen)
                        created = created + 1
                    end
                end
            end

            if created == 0 and updated == 0 then
                debug("Keine Änderungen notwendig")
                return
            end

            -- --------------------------------------------------
            -- Aktualisierte Liste nach Firestore schreiben
            -- --------------------------------------------------
            Firebase.UpdateCitizens(portalCitizens, function(ok)
                if ok then
                    log(("✅ Sync abgeschlossen: %d neu angelegt, %d aktualisiert"):format(created, updated))
                else
                    log("❌ Fehler beim Schreiben nach Firestore")
                end
            end)
        end)
    end)
end

-- ============================================================
-- Einzelnen Charakter synchronisieren (bei Charakter-Load)
-- ============================================================

--- Synchronisiert einen einzelnen Charakter-Datensatz mit dem Portal.
--- Wird z.B. beim Laden eines Charakters im Spiel aufgerufen.
--- @param charData table  Normiertes Charakter-Objekt (wie aus fetchCharacters)
local function syncSingleCharacter(charData)
    if not charData or charData.name == "" then return end
    debug("Einzelsync: " .. charData.name)

    Firebase.GetDocument(function(success, portalData)
        if not success then return end

        local citizens = portalData.citizens or {}
        local existing = nil

        for _, c in ipairs(citizens) do
            if charData.fivemId ~= "" and c.fivemId == charData.fivemId then
                existing = c; break
            end
        end
        if not existing then
            for _, c in ipairs(citizens) do
                if c.name == charData.name then existing = c; break end
            end
        end

        if existing then
            if Config.Sync.AutoUpdateCitizens then
                if Config.FieldMapping.SyncPhone       then existing.phone       = charData.phone end
                if Config.FieldMapping.SyncDateOfBirth then existing.dateOfBirth = charData.dateOfBirth end
                if Config.FieldMapping.SyncAge         then existing.age         = charData.age end
                if Config.FieldMapping.SyncGender      then existing.gender      = charData.gender end
                if Config.FieldMapping.SyncFivemId     then existing.fivemId     = charData.fivemId end
                if Config.FieldMapping.SyncSteamId     then existing.steamId     = charData.steamId end
                existing.lastFivemSync = os.date("!%Y-%m-%dT%H:%M:%SZ")
                existing.syncSource    = "fivem"
                Firebase.UpdateCitizens(citizens)
            end
        elseif Config.Sync.AutoCreateCitizens then
            local newCitizen = {
                id          = os.time() * 1000 + math.random(0, 999),
                name        = charData.name,
                phone       = charData.phone,
                address     = charData.address,
                status      = Config.StatusMapping.Default,
                dateOfBirth = charData.dateOfBirth,
                age         = charData.age,
                gender      = charData.gender,
                fivemId     = charData.fivemId,
                steamId     = charData.steamId,
                syncSource  = "fivem",
                lastFivemSync = os.date("!%Y-%m-%dT%H:%M:%SZ"),
                notes       = {},
            }
            table.insert(citizens, newCitizen)
            Firebase.UpdateCitizens(citizens)
        end
    end)
end

-- ============================================================
-- Framework-Events (QBCore / ESX)
-- ============================================================

local function setupFrameworkEvents()
    local fw = Config.Framework

    if fw == "qbcore" then
        -- QBCore: Charakter wird geladen
        AddEventHandler("QBCore:Server:PlayerLoaded", function(player)
            if not Config.Sync.SyncOnCharacterLoad then return end
            local citizenId = player.PlayerData.citizenid or ""
            local charInfo  = player.PlayerData.charinfo   or {}
            local metadata  = player.PlayerData.metadata   or {}

            local firstName = charInfo.firstname or charInfo.first_name or ""
            local lastName  = charInfo.lastname  or charInfo.last_name  or ""
            local fullName  = (firstName .. " " .. lastName):match("^%s*(.-)%s*$")
            if fullName == "" then return end

            local dob   = charInfo.birthdate or charInfo.dateofbirth or ""
            local phone = charInfo.phone or metadata.phoneNumber or metadata.phone_number or ""

            syncSingleCharacter({
                fivemId     = tostring(citizenId),
                steamId     = tostring(player.PlayerData.license or GetPlayerIdentifierByType(player.PlayerData.source and tostring(player.PlayerData.source) or "0", "steam") or ""),
                name        = fullName,
                phone       = tostring(phone),
                dateOfBirth = normalizeDateOfBirth(dob),
                age         = calculateAge(dob),
                gender      = mapGender(charInfo.gender),
                address     = "",
            })
        end)

    elseif fw == "esx" then
        -- ESX: Charakter wird geladen
        AddEventHandler("esx:playerLoaded", function(source, xPlayer)
            if not Config.Sync.SyncOnCharacterLoad then return end
            local cfg = Config.Database.ESX
            local firstName = xPlayer.get("firstName")  or ""
            local lastName  = xPlayer.get("lastName")   or ""
            local fullName  = (firstName .. " " .. lastName):match("^%s*(.-)%s*$")
            if fullName == "" then return end

            local dob   = xPlayer.get("dateofbirth") or ""
            local phone = (cfg.PhoneColumn ~= "" and xPlayer.get("phone_number")) or ""

            syncSingleCharacter({
                fivemId     = "",
                steamId     = tostring(xPlayer.getIdentifier()),
                name        = fullName,
                phone       = tostring(phone),
                dateOfBirth = normalizeDateOfBirth(dob),
                age         = calculateAge(dob),
                gender      = mapGender(xPlayer.get("sex")),
                address     = "",
            })
        end)
    end
end

-- ============================================================
-- Exports (für andere Ressourcen)
-- ============================================================

--- Manuellen Sync auslösen
exports("TriggerSync", function()
    log("Manueller Sync ausgelöst")
    performSync()
end)

--- Einzelnen Charakter synchronisieren
--- @param data table { name, phone, dateOfBirth, age, gender, fivemId, steamId, address }
exports("SyncCharacter", function(data)
    syncSingleCharacter(data)
end)

-- ============================================================
-- Server-Befehl (Admin-Konsole)
-- ============================================================

RegisterCommand("lspdsync", function(source, args)
    if source ~= 0 then
        -- Nur aus der Server-Konsole oder von Admins erlaubt
        log("⚠️ Befehl nur in der Server-Konsole verfügbar")
        return
    end
    log("Manueller Sync via Konsolenbefehl gestartet...")
    performSync()
end, true)

-- ============================================================
-- Start
-- ============================================================

AddEventHandler("onResourceStart", function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end

    log("✅ LSPD Portal Sync gestartet (Framework: " .. Config.Framework .. ")")
    setupFrameworkEvents()

    if Config.Sync.SyncOnStart then
        -- Kurze Verzögerung, damit die MySQL-Verbindung bereit ist
        Citizen.SetTimeout(5000, function()
            performSync()
        end)
    end

    -- Automatisches Sync-Intervall einrichten
    if Config.Sync.AutoSyncInterval > 0 then
        Citizen.CreateThread(function()
            while true do
                Citizen.Wait(Config.Sync.AutoSyncInterval * 1000)
                debug("⏰ Auto-Sync wird ausgeführt...")
                performSync()
            end
        end)
    end
end)
