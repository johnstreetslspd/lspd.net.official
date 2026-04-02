-- ============================================================
-- lspd-tablet  |  client/main.lua
-- ============================================================

local isOpen = false

-- ──────────────────────────────────────────────────────────
-- Job-Prüfung
-- ──────────────────────────────────────────────────────────
local function isAllowedJob()
    if not Config.AllowedJobs or #Config.AllowedJobs == 0 then
        return true -- kein Job-Check
    end

    local job = nil

    if Config.Framework == "qbcore" then
        local ok, QBCore = pcall(function()
            return exports["qb-core"]:GetCoreObject()
        end)
        if ok and QBCore then
            local pd = QBCore.Functions.GetPlayerData()
            job = pd and pd.job and pd.job.name
        end

    elseif Config.Framework == "esx" then
        local ok, ESX = pcall(function()
            return exports["es_extended"]:getSharedObject()
        end)
        if ok and ESX then
            local pd = ESX.GetPlayerData()
            job = pd and pd.job and pd.job.name
        end
    end

    if not job then return true end -- Framework nicht geladen → zulassen

    for _, allowed in ipairs(Config.AllowedJobs) do
        if job == allowed then return true end
    end
    return false
end

-- ──────────────────────────────────────────────────────────
-- Tablet öffnen / schließen
-- ──────────────────────────────────────────────────────────
local function openTablet()
    if isOpen then return end
    isOpen = true
    SetNuiFocus(true, true)

    local url = Config.WebsiteUrl
    if Config.ClearSessionOnOpen then
        -- Fragt das Portal, die gespeicherte Sitzung zu ignorieren,
        -- damit sich jeder Polizist selbst anmelden muss.
        local sep = url:find("?") and "&" or "?"
        url = url .. sep .. "newSession=1"
    end

    SendNUIMessage({ type = "openTablet", url = url, resourceName = GetCurrentResourceName() })
end

local function closeTablet()
    if not isOpen then return end
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ type = "closeTablet" })
end

-- ──────────────────────────────────────────────────────────
-- ox_inventory Export: wird aufgerufen wenn Item benutzt wird
-- (in ox_inventory items.lua muss client.export gesetzt sein)
-- ──────────────────────────────────────────────────────────
exports("useTablet", function(_, _)
    if isOpen then
        closeTablet()
        return
    end

    if not isAllowedJob() then
        -- Einfache Benachrichtigung (kompatibel mit ox_lib und ohne)
        if GetResourceState("ox_lib") == "started" then
            exports.ox_lib:notify({
                title = "Kein Zugriff",
                description = "Du bist kein Polizist!",
                type = "error",
            })
        else
            SetNotificationTextEntry("STRING")
            AddTextComponentString("~r~Kein Zugriff: Du bist kein Polizist!")
            DrawNotification(false, true)
        end
        return
    end

    openTablet()
end)

-- ──────────────────────────────────────────────────────────
-- NUI-Callback: Schließen-Button im HTML
-- ──────────────────────────────────────────────────────────
RegisterNUICallback("closeTablet", function(_, cb)
    closeTablet()
    cb({})
end)

-- ──────────────────────────────────────────────────────────
-- ESC-Taste schließt das Tablet
-- ──────────────────────────────────────────────────────────
CreateThread(function()
    while true do
        if isOpen then
            Wait(0) -- Frame-genaue Eingabe nur wenn das Tablet offen ist
            if IsControlJustPressed(0, 200) then -- INPUT_FRONTEND_CANCEL = Escape
                closeTablet()
            end
        else
            Wait(500) -- Kaum CPU-Last wenn das Tablet geschlossen ist
        end
    end
end)
