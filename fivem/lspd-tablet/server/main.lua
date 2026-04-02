-- ============================================================
-- lspd-tablet  |  server/main.lua
-- Registriert das LSPD-Tablet-Item in ox_inventory,
-- sobald die Resource gestartet ist.
-- ============================================================

local MAX_ATTEMPTS = 10

local function registerItem(attempt)
    attempt = attempt or 1

    if GetResourceState("ox_inventory") ~= "started" then
        if attempt < MAX_ATTEMPTS then
            print(("^3[lspd-tablet] ox_inventory noch nicht bereit (Versuch %d/%d), warte %d s …^0")
                :format(attempt, MAX_ATTEMPTS, attempt))
            -- Back-off: wait attempt * 1 second before retrying
            SetTimeout(attempt * 1000, function()
                registerItem(attempt + 1)
            end)
        else
            print("^1[lspd-tablet] FEHLER: ox_inventory ist nach " .. MAX_ATTEMPTS
                .. " Versuchen nicht gestartet – Item '" .. Config.ItemName .. "' wurde NICHT registriert.^0")
        end
        return
    end

    -- ox_inventory erwartet eine Tabelle mit { [itemName] = itemDefinition }
    -- "client.export" ruft exports['lspd-tablet'].useTablet() auf der Client-Seite
    -- auf, sobald ein Spieler das Item benutzt.
    local ok, err = pcall(function()
        exports.ox_inventory:Items({
            [Config.ItemName] = {
                label       = "LSPD Tablet",
                weight      = 500,
                stack       = false,
                degrade     = false,
                description = "Dienstliches LSPD Tablet zum Zugriff auf das LSPD Portal.",
                client = {
                    export = "lspd-tablet.useTablet",
                },
            },
        })
    end)

    if ok then
        print("^2[lspd-tablet] Item '" .. Config.ItemName .. "' erfolgreich bei ox_inventory registriert.^0")
    else
        print("^1[lspd-tablet] FEHLER beim Registrieren des Items: " .. tostring(err) .. "^0")
        -- Retry once more in case the export was not yet available
        if attempt < MAX_ATTEMPTS then
            SetTimeout(attempt * 1000, function()
                registerItem(attempt + 1)
            end)
        end
    end
end

AddEventHandler("onResourceStart", function(resourceName)
    if resourceName == GetCurrentResourceName() then
        -- Warte 1 Sekunde, damit ox_inventory sicher gestartet ist
        SetTimeout(1000, function()
            registerItem()
        end)
    end
end)
