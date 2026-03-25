// ============================================
// db.js – Firebase Firestore Only für LSPD Portal
// Alle Daten werden über Firebase synchronisiert
// ============================================

// Modulares Rollen- & Rang-System: Alle Rollen und Ränge sind vollständige
// Objekte und vom Admin frei konfigurierbar (Farbe, Icon, Priorität, etc.).

// Verfügbare Berechtigungs-Features
const ALL_FEATURES = ['users', 'ranks', 'employees', 'citizens', 'evidence', 'training', 'applications', 'citations', 'charges', 'press', 'requests', 'admin'];

// Standard-Rollen (werden als Objekte gespeichert)
const DEFAULT_ROLES_DATA = [
    { id: 'role_admin',       name: 'Admin',              color: '#ff3333', icon: 'fas fa-crown',            priority: 100, description: 'Vollzugriff auf alle Systeme',         isDefault: true, permissions: ['users','ranks','employees','citizens','evidence','training','applications','citations','charges','press','requests','admin'] },
    { id: 'role_commissioner',name: 'Commissioner',       color: '#ffaa00', icon: 'fas fa-star',             priority: 90,  description: 'Oberste Leitung & Aufsicht',            isDefault: true, permissions: ['users','employees','citizens','evidence','training','applications','press','requests'] },
    { id: 'role_leitung',     name: 'Leitungsebene',      color: '#0088ff', icon: 'fas fa-user-tie',         priority: 70,  description: 'Team-Leitung & Koordination',            isDefault: true, permissions: ['employees','citizens','evidence','training','ranks','applications','citations','charges','press','requests'] },
    { id: 'role_personal',    name: 'Personalverwaltung', color: '#aa66ff', icon: 'fas fa-users-cog',        priority: 60,  description: 'Personal- und Nutzerverwaltung',         isDefault: true, permissions: ['users','ranks','employees','applications','press','requests'] },
    { id: 'role_ausbilder',   name: 'Ausbilder',          color: '#00ddff', icon: 'fas fa-chalkboard-teacher',priority: 50,  description: 'Schulung & Ausbildung neuer Beamter',    isDefault: true, permissions: ['training','employees','citizens','evidence','applications','charges','press'] },
    { id: 'role_mitarbeiter', name: 'Mitarbeiter',        color: '#00ff88', icon: 'fas fa-id-badge',         priority: 30,  description: 'Standard-Beamter im Dienst',             isDefault: true, permissions: ['citizens','evidence','applications','press'] },
    { id: 'role_trainee',     name: 'Trainee',            color: '#b0b8d0', icon: 'fas fa-user-graduate',    priority: 10,  description: 'Auszubildender mit eingeschränktem Zugriff', isDefault: true, permissions: ['citizens'] }
];

// Standard-Abteilungen
const DEFAULT_DEPARTMENTS = [
    { id: 'dept_patrol',  name: 'Streifendienst',   color: '#0066cc', icon: 'fas fa-car',       description: 'Allgemeiner Streifendienst' },
    { id: 'dept_detektiv',name: 'Kriminalpolizei',   color: '#ff3333', icon: 'fas fa-search',    description: 'Ermittlungen & Kriminalfälle' },
    { id: 'dept_swat',    name: 'SWAT',              color: '#333333', icon: 'fas fa-shield-alt', description: 'Spezialeinsatzkommando' },
    { id: 'dept_verkehr', name: 'Verkehrspolizei',   color: '#ffaa00', icon: 'fas fa-traffic-light', description: 'Verkehrsüberwachung' },
    { id: 'dept_ausbildung', name: 'Ausbildung',     color: '#00ddff', icon: 'fas fa-graduation-cap', description: 'Nachwuchsausbildung' }
];

// Global Database - Zentrale Datenquelle
let database = {
    users: [
        { id: 1, username: 'Admin', password: 'Admin123!', role: 'Admin', jobRank: 'Admin', status: 'Aktiv', created: new Date().toISOString() }
    ],
    // Modulares Rang-System: Jeder Rang ist ein vollständiges Objekt
    jobRanks: [
        { id: 1, name: 'Admin',   color: '#ff0000', icon: 'fas fa-crown',       priority: 100, department: '',            abbreviation: 'ADM', description: 'Systemadministrator' },
        { id: 2, name: 'Chief',   color: '#0066cc', icon: 'fas fa-star',        priority: 90,  department: '',            abbreviation: 'CHF', description: 'Chief of Police' },
        { id: 3, name: 'Officer', color: '#00ff88', icon: 'fas fa-shield-alt',  priority: 30,  department: 'Streifendienst', abbreviation: 'OFC', description: 'Streifenbeamter' }
    ],
    // Modulares Rollen-System: Alle Rollen als konfigurierbare Objekte
    roles: null,
    // Abteilungen
    departments: null,
    employees: [],
    citizens: [],
    evidence: [],
    training: [],
    applications: [],
    citations: [],
    charges: [],
    press: [],
    auditLog: [],
    rolePermissions: null,
    customRoles: [],
    requests: [],
    news: [
        { id: 1, title: 'Willkommen im LSPD Portal', content: 'Wir heißen Sie herzlich willkommen im öffentlichen Bürgerdiensteportal der LSPD!', date: new Date().toISOString() },
        { id: 2, title: 'Neue Bewerbungsphase offen', content: 'Die nächste Bewerbungsphase für neue Beamte hat begonnen. Jetzt bewerben!', date: new Date().toISOString() }
    ]
};

// Globale Variablen für Auth
let currentUser = null;
let fsDB = null;
let firebaseEnabled = false;
let autoSyncInterval = null;

// ── Rollen-Hilfsfunktionen (global verfügbar) ──

// Gibt alle Rollen als Objekte zurück (sortiert nach Priorität absteigend)
function getAvailableRoles() {
    const roles = database.roles && database.roles.length > 0
        ? database.roles
        : JSON.parse(JSON.stringify(DEFAULT_ROLES_DATA));
    return roles.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

// Gibt alle Rollennamen als Array zurück (für Dropdowns / Rückwärtskompatibilität)
function getAllRoleNames() {
    return getAvailableRoles().map(r => r.name);
}

// Findet ein Rollenobjekt anhand des Namens
function findRoleByName(name) {
    return getAvailableRoles().find(r => r.name === name) || null;
}

// Gibt Berechtigungen für eine Rolle zurück
function getPermissionsForRole(roleName) {
    const roleObj = findRoleByName(roleName);
    if (roleObj && roleObj.permissions) return roleObj.permissions;
    // Fallback: alte rolePermissions-Map
    if (database.rolePermissions && database.rolePermissions[roleName]) {
        return database.rolePermissions[roleName];
    }
    return [];
}

// Gibt alle Abteilungen zurück
function getAvailableDepartments() {
    return (database.departments && database.departments.length > 0)
        ? database.departments
        : JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS));
}

// Migration: Konvertiert alte Datenstrukturen in das neue Format
function migrateDataIfNeeded() {
    // Rollen migrieren
    if (!database.roles || database.roles.length === 0) {
        const defaultRoles = JSON.parse(JSON.stringify(DEFAULT_ROLES_DATA));
        // Alte customRoles übernehmen
        if (database.customRoles && database.customRoles.length > 0) {
            database.customRoles.forEach(name => {
                if (!defaultRoles.find(r => r.name === name)) {
                    const perms = (database.rolePermissions && database.rolePermissions[name]) || [];
                    defaultRoles.push({
                        id: 'role_custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                        name: name,
                        color: '#888888',
                        icon: 'fas fa-user-tag',
                        priority: 20,
                        description: 'Benutzerdefinierte Rolle',
                        isDefault: false,
                        permissions: perms
                    });
                }
            });
        }
        // Alte rolePermissions in neue Rollen übernehmen
        if (database.rolePermissions) {
            defaultRoles.forEach(role => {
                if (database.rolePermissions[role.name]) {
                    role.permissions = database.rolePermissions[role.name];
                }
            });
        }
        database.roles = defaultRoles;
    }
    // Abteilungen migrieren
    if (!database.departments || database.departments.length === 0) {
        database.departments = JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS));
    }
    // Ränge migrieren: Fehlende Felder ergänzen
    if (database.jobRanks) {
        database.jobRanks.forEach(rank => {
            if (!rank.icon) rank.icon = 'fas fa-award';
            if (rank.priority === undefined) rank.priority = 0;
            if (!rank.department) rank.department = '';
            if (!rank.abbreviation) rank.abbreviation = '';
            if (!rank.description) rank.description = '';
        });
    }
    // rolePermissions aus Rollen-Objekten synchronisieren (Rückwärtskompatibilität)
    _syncRolePermissions();
}

// Synchronisiert database.rolePermissions aus den Rollen-Objekten
function _syncRolePermissions() {
    const perms = {};
    getAvailableRoles().forEach(r => { perms[r.name] = r.permissions || []; });
    database.rolePermissions = perms;
}

// Standardberechtigungen für Rollen (Rückwärtskompatibilität)
const defaultRolePermissions = {
    Admin: ['users', 'ranks', 'employees', 'citizens', 'evidence', 'training', 'applications', 'citations', 'charges', 'press', 'requests', 'admin'],
    Commissioner: ['users', 'employees', 'citizens', 'evidence', 'training', 'applications', 'press', 'requests'],
    Leitungsebene: ['employees', 'citizens', 'evidence', 'training', 'ranks', 'applications', 'citations', 'charges', 'press', 'requests'],
    Personalverwaltung: ['users', 'ranks', 'employees', 'applications', 'press', 'requests'],
    Ausbilder: ['training', 'employees', 'citizens', 'evidence', 'applications', 'charges', 'press'],
    Mitarbeiter: ['citizens', 'evidence', 'applications', 'press'],
    Trainee: ['citizens']
};

// 🔥 Firebase Firestore initialisieren
function initFirestoreDB() {
    try {
        if (window.firebase && window.firebase.firestore) {
            fsDB = window.firebase.firestore();
            firebaseEnabled = true;
            console.log('✅ Firestore initialisiert (Firebase-Only Mode)');
            
            // Starte Auto-Sync nach erfolgreicher Initialisierung
            startAutoSync();
            
            return true;
        } else {
            console.error('❌ Firebase Firestore nicht verfügbar');
            firebaseEnabled = false;
            return false;
        }
    } catch (error) {
        console.error('❌ Firestore Init Error:', error);
        firebaseEnabled = false;
        return false;
    }
}

// Überprüfe Firebase-Status und initialisiere wenn ready
function checkFirebaseReady() {
    if (window.firebase && window.firebase.firestore) {
        initFirestoreDB();
    } else {
        console.warn('⚠️ Firebase wird noch geladen...');
        setTimeout(checkFirebaseReady, 500);
    }
}

// Starte Überprüfung sobald dieses Skript geladen ist
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkFirebaseReady, 100);
});

// Fallback: Überprüfe auch nach kurzer Zeit
setTimeout(checkFirebaseReady, 500);

// 💾 Speichere Daten in Firestore (Einzige Datenquelle)
async function saveToFirestore() {
    if (!firebaseEnabled || !fsDB) {
        console.warn('⚠️ Firestore nicht verfügbar - Daten werden lokal behalten');
        return false;
    }

    try {
        // rolePermissions synchronisieren bevor gespeichert wird
        _syncRolePermissions();

        await fsDB.collection('lspdDatabase').doc('shared').set({
            users: database.users,
            jobRanks: database.jobRanks,
            roles: database.roles,
            departments: database.departments,
            employees: database.employees,
            citizens: database.citizens,
            evidence: database.evidence,
            training: database.training,
            applications: database.applications,
            citations: database.citations,
            charges: database.charges,
            press: database.press,
            auditLog: database.auditLog,
            rolePermissions: database.rolePermissions,
            customRoles: database.customRoles,
            requests: database.requests,
            news: database.news,
            lastUpdated: new Date().toISOString()
        });
        
        console.log('✅ Daten zu Firestore gespeichert');
        return true;
    } catch (error) {
        console.error('❌ Firestore Save Error:', error);
        return false;
    }
}

// 📖 Lade Daten von Firestore (Einzige Datenquelle)
async function loadFromFirestore() {
    if (!firebaseEnabled || !fsDB) {
        console.warn('⚠️ Firestore nicht verfügbar - nutze lokale Daten');
        return false;
    }

    try {
        const doc = await fsDB.collection('lspdDatabase').doc('shared').get();
        
        if (doc.exists) {
            const data = doc.data();
            database.users = data.users || database.users;
            database.jobRanks = data.jobRanks || database.jobRanks;
            database.roles = data.roles || null;
            database.departments = data.departments || null;
            database.employees = data.employees || database.employees;
            database.citizens = data.citizens || database.citizens;
            database.evidence = data.evidence || database.evidence;
            database.training = data.training || database.training;
            database.applications = data.applications || database.applications;
            database.citations = data.citations || database.citations;
            database.charges = data.charges || database.charges;
            database.press = data.press || database.press;
            database.auditLog = data.auditLog || database.auditLog;
            database.requests = data.requests || database.requests;
            database.news = data.news || database.news;
            database.customRoles = data.customRoles || [];
            database.rolePermissions = data.rolePermissions || null;
            
            // Migration auf neues Rollen-/Rang-System
            migrateDataIfNeeded();
            
            console.log('✅ Daten von Firestore geladen');
            return true;
        } else {
            console.log('ℹ️ Keine Daten in Firestore - nutze Standard');
            migrateDataIfNeeded();
            return false;
        }
    } catch (error) {
        console.error('❌ Firestore Load Error:', error);
        return false;
    }
}

// 🔄 Periodisches Sync (alle 5 Sekunden) - Live Updates
function startAutoSync() {
    // Verhindere mehrfache Intervalle
    if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
    }
    
    console.log('🔄 Auto-Sync wird gestartet (alle 5 Sekunden)');
    
    autoSyncInterval = setInterval(() => {
        if (firebaseEnabled) {
            loadFromFirestore().then(() => {
                if (typeof refreshUI === 'function') refreshUI();
            }).catch(e => console.warn('Auto-sync from Firestore failed:', e));
        }
    }, 5000);
}

// Stoppe Auto-Sync bei Logout
function stopAutoSync() {
    if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
        autoSyncInterval = null;
        console.log('✓ Auto-Sync gestoppt');
    }
}

// 💾 Speichere Daten lokal (Fallback)
function saveDatabase() {
    _syncRolePermissions();
    if (firebaseEnabled) {
        saveToFirestore().catch(e => console.error('Firebase sync failed:', e));
    } else {
        console.warn('⚠️ Firestore nicht verfügbar - Daten werden nur lokal gespeichert');
    }
}

// 📖 Lade Daten
function loadDatabase() {
    if (firebaseEnabled) {
        loadFromFirestore().catch(e => console.warn('Firestore load failed:', e));
    } else {
        console.warn('⚠️ Firestore nicht verfügbar - nutze lokale Daten');
        migrateDataIfNeeded();
    }
}

console.log('✅ db.js geladen - Modulares Rang- & Rollen-System aktiv');