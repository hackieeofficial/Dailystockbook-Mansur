import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { requestFCMToken } from '../lib/firebase';

export function usePushNotifications() {
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    if (!user) return;

    if (Capacitor.isNativePlatform()) {
      const registerPush = async () => {
        try {
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            // Do not aggressively prompt on app load. Let the user enable it in Settings.
            return;
          }
          if (permStatus.receive !== 'granted') {
            console.log('User denied push notification permission');
            return;
          }
          await PushNotifications.register();
        } catch (error) {
          console.error('Error registering for push notifications:', error);
        }
      };

      const addListeners = async () => {
        await PushNotifications.addListener('registration', async (token) => {
          console.info('Push registration success, token: ' + token.value);
          if (user?.id) {
            try {
              await supabase
                .from('profiles')
                .update({ fcm_token: token.value })
                .eq('id', user.uid);
            } catch (e) {
              console.error('Error saving push token to DB:', e);
            }
          }
        });
        await PushNotifications.addListener('registrationError', err => {
          console.error('Push registration error: ', err.error);
        });
        await PushNotifications.addListener('pushNotificationReceived', notification => {
          console.log('Push received: ', notification);
        });
        await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
          console.log('Push action performed: ', notification.actionId, notification.inputValue);
        });
      };

      registerPush();
      addListeners();

      return () => {
        PushNotifications.removeAllListeners();
      };
    } else {
      // Web Push
      const registerWebPush = async () => {
        try {
          if (!('Notification' in window)) {
            console.log('This browser does not support desktop notification');
            return;
          }
          
          if (Notification.permission === 'denied') return;

          // Do not automatically prompt workers for notification permission on app load.
          if (Notification.permission === 'default' && user.role !== 'admin') {
            return;
          }

          // Check if this user already has a token saved
          const { data: profile } = await supabase
            .from('profiles')
            .select('fcm_token')
            .eq('id', user.uid)
            .single();

          // We MUST call requestFCMToken() every time if permission is granted to bind the foreground listener.
          if (Notification.permission === 'granted' || (Notification.permission === 'default' && user.role === 'admin')) {
            const token = await requestFCMToken();
            if (token && user?.id && profile?.fcm_token !== token) {
              await supabase
                .from('profiles')
                .update({ fcm_token: token })
                .eq('id', user.uid);
              console.log('Web FCM token saved to profile (new or updated).');
            } else if (token) {
              console.log('Web FCM token active and matches profile.');
            }
          }
        } catch (error) {
          console.error('Error in Web FCM token auto-registration:', error);
        }
      };
      
      registerWebPush();
    }
  }, [user]);
}

