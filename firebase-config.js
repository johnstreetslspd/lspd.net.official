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

// Firebase v9 Compat - App initialisieren mit Überprüfung
function initializeFirebase() {
  try {
    if (window.firebase && window.firebase.apps) {
      if (window.firebase.apps.length === 0) {
        window.firebaseApp = window.firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase App initialisiert');
        return true;
      } else {
        window.firebaseApp = window.firebase.apps[0];
        console.log('✅ Firebase App bereits initialisiert');
        return true;
      }
    } else {
      console.error('❌ Firebase SDK nicht geladen. Überprüfen Sie die Script-Tags.');
      return false;
    }
  } catch (error) {
    console.error('❌ Firebase Init Error:', error);
    return false;
  }
}

// Versuche zu initialisieren, wenn das Skript geladen wird
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
  setTimeout(initializeFirebase, 100);
}
