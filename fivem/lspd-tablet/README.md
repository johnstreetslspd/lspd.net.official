# lspd-tablet

FiveM-Resource, die Polizisten per **Ox-Inventory-Item** das LSPD-Portal im integrierten Browser öffnet.  
Jeder Spieler muss sich mit seinem eigenen Konto anmelden – keine geteilten Sitzungen.

---

## Inhalt

```
lspd-tablet/
├── fxmanifest.lua
├── config.lua
├── client/
│   └── main.lua       ← NUI-Steuerung, Job-Prüfung, Ox-Inventory-Export
├── server/
│   └── main.lua       ← Item-Registrierung bei ox_inventory
└── html/
    ├── index.html     ← Tablet-UI (Vollbild-Overlay mit iFrame)
    └── style.css
```

---

## Voraussetzungen

| Abhängigkeit | Hinweis |
|---|---|
| **ox_inventory** | v3 oder neuer |
| **qb-core** *oder* **es_extended** | Optional; nur für Job-Prüfung nötig |
| **ox_lib** | Optional; für hübschere Fehlermeldungen |

---

## Installation

### 1. Resource in den Server kopieren

Lege den Ordner `lspd-tablet` in dein `resources`-Verzeichnis und füge Folgendes in deine `server.cfg` ein:

```cfg
ensure lspd-tablet
```

### 2. config.lua anpassen

```lua
-- URL deiner LSPD-Website (Login-Seite)
Config.WebsiteUrl = "https://deine-domain.de/mitarbeiter-portal.html"

-- Framework: "qbcore" | "esx" | "standalone"
Config.Framework = "qbcore"

-- Erlaubte Jobs
Config.AllowedJobs = { "police", "lspd", "sheriff" }

-- true  = Spieler muss sich JEDES MAL neu anmelden
-- false = bereits angemeldete Sitzung bleibt erhalten (Standard)
Config.ClearSessionOnOpen = false
```

### 3. Item in ox_inventory registrieren

Die Resource registriert das Item automatisch beim Start über `exports.ox_inventory:Items()`.  
Alternativ kannst du es **manuell** in `ox_inventory/data/items.lua` eintragen:

```lua
['lspd_tablet'] = {
    label       = 'LSPD Tablet',
    weight      = 500,
    stack       = false,
    degrade     = false,
    description = 'Dienstliches LSPD Tablet.',
    client = {
        export = 'lspd-tablet.useTablet',
    },
},
```

### 4. Item an Polizisten verteilen

Gib das Item per Inventory-Management, Spawner oder SQL an deine Polizisten aus, z.B.:

```lua
exports.ox_inventory:AddItem(source, 'lspd_tablet', 1)
```

---

## Benutzung im Spiel

1. Spieler öffnet sein Inventar.
2. Klickt das **LSPD Tablet**-Item an und wählt „Benutzen".
3. Das Portal öffnet sich im Vollbild-Overlay.
4. Der Spieler meldet sich **mit seinen eigenen Zugangsdaten** an.
5. **ESC** oder der **✕-Button** schließt das Tablet wieder.

---

## Session-Verhalten

FiveM verwendet für jeden Spieler einen eigenen CEF-Browser-Prozess.  
`localStorage` ist daher **bereits pro Spieler getrennt** – es gibt keine gemeinsamen Sitzungen zwischen verschiedenen Spielern.

`Config.ClearSessionOnOpen = true` fügt dem URL-Aufruf `?newSession=1` hinzu.  
Das Portal erkennt diesen Parameter und verwirft die gespeicherte Sitzung, sodass der Spieler sich trotz vorhandener Session neu anmelden muss.
