// db.js - Firestore Database Layer
// Konzentriert sich NUR auf Firestore, nicht LocalStorage

let fsDB = null;
let firebaseEnabled = false;

// Firestore initialisieren
function initFirestoreDB() {
    try {
        if (window.firebase && window.firebase.firestore) {
            fsDB = window.firebase.firestore();
            firebaseEnabled = true;
            console.log('Firestore initialized');
            return true;
        } else {
            console.warn('Firebase Firestore not available');
            firebaseEnabled = false;
            return false;
        }
    } catch (error) {
        console.error('Firestore Init Error:', error);
        firebaseEnabled = false;
        return false;
    }
}

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.firebase) {
        initFirestoreDB();
    }
});

// SPEICHERN zu Firestore (SOURCE OF TRUTH!)
async function saveToFirestore() {
    if (!firebaseEnabled || !fsDB) {
        console.warn('Firestore not active');
        return false;
    }

    try {
        console.log('SAVING TO FIRESTORE - Users: ' + database.users.length + ', Citizens: ' + database.citizens.length);
        
        // Speichere ALLES zu Firestore
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
        
        console.log('SUCCESS: Firestore saved!');
        return true;
        
    } catch (error) {
        console.error('FIRESTORE ERROR:', error.message);
        
        if (error.code === 'permission-denied') {
            console.error('PERMISSION DENIED!!!');
            console.error('FIX: Go to Firebase Console > Firestore > Rules');
            console.error('Set: allow read, write: if true;');
        }
        return false;
    }
}

// LADEN von Firestore
async function loadFromFirestore() {
    if (!firebaseEnabled || !fsDB) {
        console.warn('Firestore not active');
        return false;
    }

    try {
        const doc = await fsDB.collection('lspdDatabase').doc('shared').get();
        
        if (doc.exists) {
            const data = doc.data();
            database.users = data.users || database.users || [];
            database.jobRanks = data.jobRanks || database.jobRanks || [];
            database.employees = data.employees || database.employees || [];
            database.citizens = data.citizens || database.citizens || [];
            database.evidence = data.evidence || database.evidence || [];
            database.training = data.training || database.training || [];
            database.auditLog = data.auditLog || database.auditLog || [];
            database.rolePermissions = data.rolePermissions || database.rolePermissions;
            
            console.log('LOADED FROM FIRESTORE - Users: ' + database.users.length + ', Citizens: ' + database.citizens.length);
            return true;
        } else {
            console.log('No data in Firestore yet');
            return false;
        }
    } catch (error) {
        console.error('FIRESTORE LOAD ERROR:', error.message);
        return false;
    }
}

// Auto-sync alle 30 Sekunden
function startAutoSync() {
    setInterval(() => {
        if (firebaseEnabled && currentUser) {
            saveToFirestore().catch(e => console.warn('Auto-sync failed:', e));
        }
    }, 30000);
}

console.log('db.js loaded - Firestore only');
