fx_version 'cerulean'
game 'gta5'

name        'lspd-portal-sync'
description 'Synchronisiert FiveM-Charakterdaten mit dem LSPD Web-Portal (Firebase Firestore)'
author      'LSPD'
version     '1.0.0'

-- Serverseitige Skripte (werden nur auf dem Server ausgeführt)
server_scripts {
    'config.lua',
    'server/firebase.lua',
    'server/main.lua',
}

-- Benötigte Abhängigkeiten (mindestens eine MySQL-Bibliothek muss vorhanden sein)
-- dependencies {
--     'oxmysql',
-- }
