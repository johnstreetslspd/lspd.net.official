// ============================================
// db.js – Firebase Firestore Only für LSPD Portal
// Alle Daten werden über Firebase synchronisiert
// ============================================

// Global Database - Zentrale Datenquelle
let database = {
    users: [
        { id: 1, username: 'Admin', password: 'Admin123!', role: 'Admin', jobRank: 'Admin', status: 'Aktiv', created: new Date().toISOString() }
    ],
    jobRanks: [
        { id: 1, name: 'Admin', color: '#ff0000' },
        { id: 2, name: 'Chief', color: '#0066cc' },
        { id: 3, name: 'Officer', color: '#00ff88' }
    ],
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

// Standardberechtigungen für Rollen
const defaultRolePermissions = {
    Admin: ['users', 'ranks', 'employees', 'citizens', 'evidence', 'training', 'applications', 'citations', 'charges', 'press', 'admin'],
    Commissioner: ['users', 'employees', 'citizens', 'evidence', 'training', 'applications', 'press'],
    Leitungseben: ['employees', 'citizens', 'evidence', 'training', 'ranks', 'applications', 'citations', 'charges', 'press'],
    Personalverwaltung: ['users', 'ranks', 'employees', 'applications', 'press'],
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
        await fsDB.collection('lspdDatabase').doc('shared').set({
            users: database.users,
            jobRanks: database.jobRanks,
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
            database.rolePermissions = data.rolePermissions 
               ? { ...defaultRolePermissions, ...data.rolePermissions }
               : defaultRolePermissions;
            
            console.log('✅ Daten von Firestore geladen');
            return true;
        } else {
            console.log('ℹ️ Keine Daten in Firestore - nutze Standard');
            database.rolePermissions = { ...defaultRolePermissions };
            database.customRoles = [];
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
        database.rolePermissions = { ...defaultRolePermissions };
    }
}

console.log('✅ db.js geladen - Awaiting Firebase initialization...');