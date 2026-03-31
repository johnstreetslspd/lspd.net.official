// ========== BÜRGER-PORTAL SHARED LOGIC ==========
const DB_KEY = 'lspdCitizensData';
let database = {
    applications: [],
    requests: [],
    charges: [],
    news: [],
    press: []
};

let fsDB = null;
let firebaseEnabled = false;

const defaultNews = [
    {
        id: 1,
        title: 'Willkommen im LSPD Portal',
        content: 'Wir heißen Sie herzlich willkommen im öffentlichen Bürgerdiensteportal der LSPD!',
        date: new Date().toISOString()
    },
    {
        id: 2,
        title: 'Neue Bewerbungsphase offen',
        content: 'Die nächste Bewerbungsphase für neue Beamte hat begonnen. Jetzt bewerben!',
        date: new Date().toISOString()
    }
];

// Firebase Firestore initialisieren
function initFirestoreDB() {
    try {
        if (window.firebase && window.firebase.firestore) {
            fsDB = window.firebase.firestore();
            firebaseEnabled = true;
            console.log('✅ Firestore initialisiert (Bürger-Portal)');
            return true;
        } else {
            console.warn('⚠️ Firebase Firestore nicht verfügbar');
            firebaseEnabled = false;
            return false;
        }
    } catch (error) {
        console.error('❌ Firestore Init Error:', error);
        firebaseEnabled = false;
        return false;
    }
}

// Daten von Firestore laden
async function loadFromFirestore() {
    if (!firebaseEnabled || !fsDB) return false;

    try {
        const doc = await fsDB.collection('lspdDatabase').doc('shared').get();

        if (doc.exists) {
            const data = doc.data();
            database.applications = data.applications || database.applications;
            database.requests = data.requests || database.requests;
            database.charges = data.charges || database.charges;
            database.news = data.news || database.news;
            database.press = data.press || database.press;
            console.log('✅ Daten von Firestore geladen (Bürger-Portal)');
            return true;
        } else {
            console.log('ℹ️ Keine Daten in Firestore - nutze Standard');
            return false;
        }
    } catch (error) {
        console.error('❌ Firestore Load Error:', error);
        return false;
    }
}

// Daten zu Firestore speichern (nur Bürger-relevante Felder aktualisieren)
async function saveToFirestore() {
    if (!firebaseEnabled || !fsDB) return false;

    try {
        const doc = await fsDB.collection('lspdDatabase').doc('shared').get();
        const existingData = doc.exists ? doc.data() : {};

        await fsDB.collection('lspdDatabase').doc('shared').set({
            ...existingData,
            applications: database.applications,
            requests: database.requests,
            charges: [...(existingData.charges || []), ...database.charges.filter(c => c.source === 'citizen' && !(existingData.charges || []).find(x => x.id === c.id))],
            news: database.news,
            lastUpdated: new Date().toISOString()
        });

        console.log('✅ Daten zu Firestore gespeichert (Bürger-Portal)');
        return true;
    } catch (error) {
        console.error('❌ Firestore Save Error:', error);
        return false;
    }
}

// Datenbank initialisieren mit Standarddaten
function initDatabase() {
    database = {
        applications: [],
        requests: [],
        charges: [],
        news: [...defaultNews],
        press: []
    };
    saveDatabase();
}

// Datenbank laden
async function loadDatabase() {
    if (firebaseEnabled) {
        const loaded = await loadFromFirestore();
        if (loaded) {
            localStorage.setItem(DB_KEY, JSON.stringify(database));
            return;
        }
    }

    const stored = localStorage.getItem(DB_KEY);
    if (stored) {
        try {
            database = JSON.parse(stored);
        } catch (e) {
            console.error('Error loading database:', e);
            initDatabase();
        }
    } else {
        initDatabase();
    }
}

// Datenbank speichern
function saveDatabase() {
    localStorage.setItem(DB_KEY, JSON.stringify(database));

    if (firebaseEnabled) {
        saveToFirestore().catch(e => console.error('Firestore save failed:', e));
    }
}

// Utility functions
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(title, message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const strong = document.createElement('strong');
    strong.textContent = title;
    toast.appendChild(strong);
    toast.appendChild(document.createElement('br'));
    toast.appendChild(document.createTextNode(message));
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Initialize app - Firebase first, then load database
function initBuergerApp(callback) {
    if (window.firebase && window.firebase.firestore) {
        initFirestoreDB();
    }
    loadDatabase().then(() => {
        if (callback) callback();
    });
}
