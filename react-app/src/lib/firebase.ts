import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/auth';
import { logger } from './logger';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBvUWHMg-6J_vfkhbRxYE14LcocoaSnIdM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mansur2026feb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mansur2026feb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mansur2026feb.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "734846876875",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:734846876875:web:b3b2410643486b08bfef4e"
};

let _ready = false;

export function fbPrint() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    if (!_ready) {
      _ready = true;
      try {
        db.settings({ experimentalForceLongPolling: true });
      } catch (e) {
        logger.warn('firebase', 'init:settings', 'Firestore settings failed (non-fatal)', e);
      }
    }
    return {
      db,
      storage: firebase.storage(),
      auth: firebase.auth()
    };
  } catch (e) {
    logger.error('firebase', 'init', 'Firebase initialization failed', e);
    return null;
  }
}
