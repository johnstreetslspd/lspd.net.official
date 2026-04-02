-- ============================================================
-- lspd-tablet  |  server/main.lua
-- Registriert das LSPD-Tablet-Item in ox_inventory,
-- sobald die Resource gestartet ist.
-- ============================================================

local function registerItem()
    if GetResourceState("ox_inventory") ~= "started" then
        print("^3[lspd-tablet] Warnung: ox_inventory ist nicht gestartet – Item wird nicht registriert.^0")
        return
    end

    -- ox_inventory erwartet eine Tabelle mit { [itemName] = itemDefinition }
    -- "client.export" ruft exports['lspd-tablet'].useTablet() auf der Client-Seite
    -- auf, sobald ein Spieler das Item benutzt.
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

    print("^2[lspd-tablet] Item '" .. Config.ItemName .. "' erfolgreich bei ox_inventory registriert.^0")
end

AddEventHandler("onResourceStart", function(resourceName)
    if resourceName == GetCurrentResourceName() then
        -- Kurz warten, damit ox_inventory sicher gestartet ist
        SetTimeout(500, registerItem)
    end
end)
