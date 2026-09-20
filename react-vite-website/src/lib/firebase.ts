import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/auth';
import 'firebase/compat/messaging';
import { logger } from './logger';
import { toast } from 'sonner';

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
        db.settings({ experimentalForceLongPolling: true, merge: true });
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

export async function requestFCMToken() {
  try {
    fbPrint();
    const messaging = firebase.messaging();
    
    // Wait for Vite PWA service worker to be ready so we don't conflict
    const registration = await navigator.serviceWorker.ready;
    
    const token = await messaging.getToken({ 
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    
    if (token) {
      logger.info('firebase', 'requestFCMToken', 'FCM Token generated successfully', token.substring(0,10) + '...');
      setupForegroundListener();
      return token;
    } else {
      logger.warn('firebase', 'requestFCMToken', 'No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (error) {
    logger.error('firebase', 'requestFCMToken', 'An error occurred while retrieving token.', error);
    return null;
  }
}

let _listenerSetup = false;
export function setupForegroundListener() {
  if (_listenerSetup) return;
  _listenerSetup = true;
  try {
    fbPrint();
    const messaging = firebase.messaging();
    messaging.onMessage(async (payload: any) => {
      console.log('Received foreground message ', payload);
      const notificationTitle = payload.notification?.title || payload.data?.title || 'DailyStock Alert';
      const notificationBody = payload.notification?.body || payload.data?.body || 'You have a new message.';
      
      const notificationOptions = {
        body: notificationBody,
        icon: '/pwa-192x192.png'
      };
      
      // Fallback: Always show an in-app toast for foreground messages
      // This guarantees visibility even if OS native notifications fail (e.g. Firefox Android Emulator, Windows Do-Not-Disturb)
      toast.success(notificationTitle, {
        description: notificationBody,
        duration: 8000
      });
      
      if (Notification.permission === 'granted') {
        // 1. Try Service Worker method (Most reliable for network events)
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(notificationTitle, notificationOptions).catch(e => {
            console.error('SW showNotification failed:', e);
          });
        });


      }
    });
  } catch (e) {
    logger.error('firebase', 'setupForegroundListener', 'Failed to setup listener', e);
  }
}

export function onMessageListener() {
  setupForegroundListener();
  return Promise.resolve();
}

