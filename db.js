// db.js – Hybrid Firestore + LocalStorage für LSPD Portal
// Firebase v9 Compat - Fallback zu LocalStorage wenn Firestore nicht verfügbar

let fsDB = null;
let firebaseEnabled = false;

// 🔥 Firebase Firestore initialisieren
function initFirestoreDB() {
    try {
        if (window.firebase && window.firebase.firestore) {
            fsDB = window.firebase.firestore();
            firebaseEnabled = true;
            console.log('✅ Firestore db.js initialized');
            return true;
        } else {
            console.warn('⚠️ Firebase Firestore not available - using LocalStorage only');
            firebaseEnabled = false;
            return false;
        }
    } catch (error) {
        console.error('❌ Firestore Init Error:', error);
        firebaseEnabled = false;
        return false;
    }
}

// Firestore muss initialisiert werden sobald Firebase verfügbar ist
document.addEventListener('DOMContentLoaded', () => {
    if (window.firebase) {
        initFirestoreDB();
    }
});

// � Speichere Daten in Firestore + LocalStorage
async function saveToFirestore() {
    if (!firebaseEnabled || !fsDB) {
        console.warn('⚠️ Firestore nicht aktiv - nur LocalStorage');
        return false;
    }

    try {
        // Speichere globale Daten im Firestore
        await fsDB.collection('lspdDatabase').doc('shared').set({
            users: database.users,
            jobRanks: database.jobRanks,
            employees: database.employees,
            citizens: database.citizens,
            evidence: database.evidence,
            training: database.training,
            auditLog: database.auditLog,
            rolePermissions: database.rolePermissions,
            lastUpdated: new Date().toISOString()
        });
        
        console.log('✅ Daten zu Firestore gespeichert');
        return true;
    } catch (error) {
        console.error('❌ Firestore Save Error:', error);
        return false;
    }
}

// 📖 Lade Daten von Firestore
async function loadFromFirestore() {
    if (!firebaseEnabled || !fsDB) {
        console.warn('⚠️ Firestore nicht aktiv');
        return false;
    }

    try {
        const doc = await fsDB.collection('lspdDatabase').doc('shared').get();
        
        if (doc.exists) {
            const data = doc.data();
            database.users = data.users || [];
            database.jobRanks = data.jobRanks || [];
            database.employees = data.employees || [];
            database.citizens = data.citizens || [];
            database.evidence = data.evidence || [];
            database.training = data.training || [];
            database.auditLog = data.auditLog || [];
            database.rolePermissions = data.rolePermissions 
               ? { ...defaultRolePermissions, ...data.rolePermissions }
               : defaultRolePermissions;
            
            console.log('✅ Daten von Firestore geladen');
            return true;
        } else {
            console.log('ℹ️ Keine Daten in Firestore - verwende LocalStorage');
            return false;
        }
    } catch (error) {
        console.error('❌ Firestore Load Error:', error);
        return false;
    }
}

// 🔄 Periodisches Sync (alle 30 Sekunden)
function startAutoSync() {
    setInterval(() => {
        if (firebaseEnabled && currentUser) {
            saveToFirestore().catch(e => console.warn('Auto-sync failed:', e));
        }
    }, 30000);
}

console.log('✅ db.js geladen und initialisiert');