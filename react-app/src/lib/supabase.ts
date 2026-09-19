import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
};

if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
  throw new Error("Missing Supabase configuration in environment variables.");
}

/** Auth storage adapter for the login "Keep me signed in" checkbox.
 *  Default (checked / flag absent) = localStorage  same as before.
 *  Unchecked = sessionStorage, so the session dies with the tab.
 *  Key contract: login page writes 'mansurKeepSignedIn' = '0' | '1'. */
const authStorage = {
  getItem: (k: string) => {
    try {
      const storage = sessionStorage.getItem('mansurKeepSignedIn') === '0' ? sessionStorage : localStorage;
      return storage.getItem(k);
    } catch (e) {
      logger.debug('storage', 'authStorage:get', 'SessionStorage read failed, falling back', e);
      return localStorage.getItem(k);
    }
  },
  setItem: (k: string, v: string) => {
    try {
      const storage = sessionStorage.getItem('mansurKeepSignedIn') === '0' ? sessionStorage : localStorage;
      storage.setItem(k, v);
      if (storage === sessionStorage) {
        try { localStorage.removeItem(k); } catch (e) { logger.debug('storage', 'authStorage:set:cleanup', 'Failed to clean localStorage', e); }
      }
    } catch (e) {
      logger.warn('storage', 'authStorage:set', 'Auth storage write failed', e);
    }
  },
  removeItem: (k: string) => {
    try { localStorage.removeItem(k); } catch (e) { logger.debug('storage', 'authStorage:remove:local', 'Failed', e); }
    try { sessionStorage.removeItem(k); } catch (e) { logger.debug('storage', 'authStorage:remove:session', 'Failed', e); }
  }
};

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  realtime: { params: { eventsPerSecond: 3 } },
  auth: { storage: authStorage }
});
