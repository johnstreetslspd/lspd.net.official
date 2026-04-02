fx_version 'cerulean'
game 'gta5'

name        'lspd-tablet'
description 'LSPD Tablet – Öffnet das LSPD Portal per Ox-Inventory-Item'
version     '1.0.0'
author      'LSPD'

shared_scripts {
    'config.lua',
}

client_scripts {
    'client/main.lua',
}

server_scripts {
    'server/main.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
}

dependencies {
    'ox_inventory',
}
