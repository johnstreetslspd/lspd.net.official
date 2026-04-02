-- ============================================================
-- server/firebase.lua – Firestore REST API Helper
-- Kapselt alle HTTP-Aufrufe an Google Firestore
-- ============================================================

Firebase = {}

-- Basis-URL für das Firestore-Dokument
local function getDocumentUrl()
    return ("https://firestore.googleapis.com/v1/projects/%s/databases/%s/documents/%s/%s"):format(
        Config.Firebase.ProjectId,
        Config.Firebase.Database,
        Config.Firebase.Collection,
        Config.Firebase.Document
    )
end

-- ============================================================
-- Firestore Typen: Lua → Firestore REST JSON
-- ============================================================

local function toFirestoreValue(val)
    local t = type(val)
    if val == nil then
        return { nullValue = "NULL_VALUE" }
    elseif t == "boolean" then
        return { booleanValue = val }
    elseif t == "number" then
        if val == math.floor(val) then
            return { integerValue = tostring(math.floor(val)) }
        else
            return { doubleValue = val }
        end
    elseif t == "string" then
        return { stringValue = val }
    elseif t == "table" then
        -- Treat as array when the table has sequential integer keys OR is empty.
        -- Empty Lua tables (e.g. notes = {}) always represent empty arrays in our
        -- data model, never empty maps.  Sending them as mapValue caused HTTP 400.
        local isArray = (#val > 0) or (next(val) == nil)
        if isArray then
            if #val == 0 then
                -- Omit the "values" key for empty arrays to avoid the JSON encoder
                -- serializing {} as an object instead of an array.
                return { arrayValue = {} }
            end
            local values = {}
            for _, v in ipairs(val) do
                table.insert(values, toFirestoreValue(v))
            end
            return { arrayValue = { values = values } }
        else
            local fields = {}
            for k, v in pairs(val) do
                fields[tostring(k)] = toFirestoreValue(v)
            end
            return { mapValue = { fields = fields } }
        end
    end
    return { nullValue = "NULL_VALUE" }
end

-- ============================================================
-- Firestore Typen: Firestore REST JSON → Lua
-- ============================================================

local function fromFirestoreValue(val)
    if val == nil then return nil end
    if val.stringValue  ~= nil then return val.stringValue end
    if val.integerValue ~= nil then return tonumber(val.integerValue) end
    if val.doubleValue  ~= nil then return tonumber(val.doubleValue) end
    if val.booleanValue ~= nil then return val.booleanValue end
    if val.nullValue    ~= nil then return nil end
    if val.arrayValue then
        local arr = {}
        if val.arrayValue.values then
            for _, v in ipairs(val.arrayValue.values) do
                table.insert(arr, fromFirestoreValue(v))
            end
        end
        return arr
    end
    if val.mapValue then
        local map = {}
        if val.mapValue.fields then
            for k, v in pairs(val.mapValue.fields) do
                map[k] = fromFirestoreValue(v)
            end
        end
        return map
    end
    return nil
end

local function fromFirestoreDocument(fields)
    local result = {}
    for k, v in pairs(fields or {}) do
        result[k] = fromFirestoreValue(v)
    end
    return result
end

-- ============================================================
-- Öffentliche API
-- ============================================================

--- Liest das vollständige Firestore-Dokument (lspdDatabase/shared).
--- @param callback function(success, data)
function Firebase.GetDocument(callback)
    local url = getDocumentUrl() .. "?key=" .. Config.Firebase.ApiKey
    if Config.Debug then
        print(Config.LogPrefix .. " GET " .. url)
    end

    PerformHttpRequest(url, function(statusCode, responseText, headers)
        if statusCode == 200 then
            local ok, data = pcall(json.decode, responseText)
            if ok and data and data.fields then
                callback(true, fromFirestoreDocument(data.fields))
            else
                print(Config.LogPrefix .. " ❌ JSON-Fehler beim Lesen des Dokuments")
                callback(false, nil)
            end
        else
            print(Config.LogPrefix .. " ❌ GET fehlgeschlagen (HTTP " .. statusCode .. ")")
            print(Config.LogPrefix .. " ❌ Firestore-Antwort: " .. (responseText or "(leer)"))
            callback(false, nil)
        end
    end, "GET", "", { ["Content-Type"] = "application/json" })
end

--- Aktualisiert nur das Feld `citizens` im Firestore-Dokument.
--- Alle anderen Felder bleiben unberührt (updateMask).
--- @param citizens table   Array mit Bürger-Objekten
--- @param callback function(success)  optional
function Firebase.UpdateCitizens(citizens, callback)
    local url = getDocumentUrl()
        .. "?updateMask.fieldPaths=citizens"
        .. "&key=" .. Config.Firebase.ApiKey

    local encodeOk, body = pcall(json.encode, {
        fields = {
            citizens = toFirestoreValue(citizens)
        }
    })

    if not encodeOk then
        print(Config.LogPrefix .. " ❌ JSON-Encoding fehlgeschlagen: " .. tostring(body))
        if callback then callback(false) end
        return
    end

    if Config.Debug then
        print(Config.LogPrefix .. " PATCH citizens (" .. #citizens .. " Einträge)")
        print(Config.LogPrefix .. " Request-Body: " .. body)
    end

    PerformHttpRequest(url, function(statusCode, responseText, headers)
        if statusCode == 200 then
            if Config.Debug then
                print(Config.LogPrefix .. " ✅ " .. #citizens .. " Bürger gespeichert")
            end
            if callback then callback(true) end
        else
            print(Config.LogPrefix .. " ❌ PATCH fehlgeschlagen (HTTP " .. statusCode .. ")")
            print(Config.LogPrefix .. " ❌ Firestore-Antwort: " .. (responseText or "(leer)"))
            if callback then callback(false) end
        end
    end, "PATCH", body, { ["Content-Type"] = "application/json" })
end
