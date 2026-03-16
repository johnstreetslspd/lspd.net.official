// Firebase Konfiguration v9 Compat
// WICHTIG: Diese Werte mit deinen Firebase-Projekt-Daten ersetzen!
// Gehe zu Firebase Console > Projekteinstellungen > Web-App

const firebaseConfig = {
  apiKey: "AIzaSyDAltEFoZPnXFyezoApgGf7FY7bAOFk5oA",
  authDomain: "lspd-roleplay.firebaseapp.com",
  projectId: "lspd-roleplay",
  storageBucket: "lspd-roleplay.firebasestorage.app",
  messagingSenderId: "213624245643",
  appId: "1:213624245643:web:295deb5eac96d9019a338e"
};

// Firebase v9 Compat - Nur App initialisieren!
// Firestore & Auth werden in db.js initialisiert
if (!window.firebase.apps || window.firebase.apps.length === 0) {
  window.firebaseApp = window.firebase.initializeApp(firebaseConfig);
  console.log('✅ Firebase App initialisiert');
}
