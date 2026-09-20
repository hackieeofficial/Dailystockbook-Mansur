importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBvUWHMg-6J_vfkhbRxYE14LcocoaSnIdM',
  authDomain: 'mansur2026feb.firebaseapp.com',
  projectId: 'mansur2026feb',
  storageBucket: 'mansur2026feb.firebasestorage.app',
  messagingSenderId: '734846876875',
  appId: '1:734846876875:web:b3b2410643486b08bfef4e'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'DailyStock Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message.',
    icon: '/pwa-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions).catch(e => console.error('Failed SW showNotification', e));
});
