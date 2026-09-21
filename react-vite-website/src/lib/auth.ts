import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_CONFIG } from './supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import type { UserIdentity } from '../types';
import { cloudPullAll, triggerEventNotification } from './syncEngine';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { logger } from './logger';

export async function loadProfile(userId: string, email: string): Promise<any> {
  try {
    const { data } = await supabase.from('profiles').select('id, email, name, role, is_disabled').eq('id', userId).single();
    if (data) {
      if (email.toLowerCase() === 'bhavesh@mansurenterprises.com' && data.role !== 'admin') {
        await supabase.from('profiles').update({ role: 'admin', is_disabled: false }).eq('id', userId);
        data.role = 'admin';
        data.is_disabled = false;
      }
      if (data.is_disabled && email.toLowerCase() !== 'bhavesh@mansurenterprises.com') {
        useAppStore.getState().logActivity('Blocked Login', 'Disabled account attempted access: ' + email);
        await supabase.auth.signOut();
        
        // Fire notification AFTER signing out — don't block or interfere with the sign out
        triggerEventNotification('login_blocked', {
          title: 'Security Alert: Login Blocked',
          body: `Disabled user ${email} attempted to log in.`
        }).catch(() => {}); // Fire-and-forget; never throw
        
        throw new Error('DISABLED_BY_ADMIN');
      }
      return data;
    }
    
    // Create basic profile if none exists
    const baseName = (email || 'Staff').split('@')[0];
    const newRow = { id: userId, email: email.toLowerCase(), name: baseName, role: 'worker' };
    
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    if (email.toLowerCase() === 'bhavesh@mansurenterprises.com' || count === 0) {
      newRow.role = 'admin';
    }
    
    const { data: insData } = await supabase.from('profiles').insert(newRow).select().single();
    
    // Don't notify when the super admin first sets up — they already know
    if (email.toLowerCase() !== 'bhavesh@mansurenterprises.com') {
      triggerEventNotification('user_created', {
        title: 'New User Registered',
        body: `A new user (${newRow.email}) has signed into the system.`
      }).catch(() => {}); // Fire-and-forget; never throw
    }
    
    return insData || newRow;
  } catch (e) {
    logger.warn('auth', 'loadProfile', 'Profile load failed, using fallback', e, { userId, email });
    return { id: userId, email: email.toLowerCase(), name: (email || 'Staff').split('@')[0], role: 'worker' };
  }
}

export async function refreshSession() {
  const authStore = useAuthStore.getState();
  authStore.setLoading(true);
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    if (session?.user) {
      const prof = await loadProfile(session.user.id, session.user.email || '');
      const identity: UserIdentity = {
        id: session.user.email || session.user.id,
        uid: session.user.id,
        email: session.user.email || '',
        name: String(prof.name || '').toUpperCase(),
        role: prof.role === 'admin' ? 'admin' : 'worker'
      };
      authStore.setUser(identity);
      
      if (session.user.user_metadata?.preferences) {
        usePreferencesStore.getState().hydrateFromServer(identity.uid, session.user.user_metadata.preferences);
      }

      // Pull initial data in background to speed up app loading
      cloudPullAll().catch(e => logger.error('auth', 'refreshSession:pull', 'Background pull failed', e));
    } else {
      authStore.setUser(null);
    }
  } catch (e) {
    logger.error('auth', 'refreshSession', 'Session refresh failed', e);
    authStore.setUser(null);
  } finally {
    authStore.setLoading(false);
  }
}

export async function login(email: string, pass: string, keepSignedIn: boolean = true) {
  const authStore = useAuthStore.getState();
  authStore.setError(null);
  authStore.setLoading(true);
  
  try {
    sessionStorage.setItem('mansurKeepSignedIn', keepSignedIn ? '1' : '0');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      let m = error.message;
      if (/invalid login/i.test(m) || /invalid credentials/i.test(m)) m = 'Wrong email or password.';
      if (/email not confirmed/i.test(m)) m = 'This login is not active yet. Contact your admin.';
      if (/failed to fetch/i.test(m) || /network request failed/i.test(m)) m = 'Cloud connection error. Check your internet.';
      throw new Error(m);
    }
    
    if (data.user) {
      const prof = await loadProfile(data.user.id, data.user.email || '');
      const identity: UserIdentity = {
        id: data.user.email || data.user.id,
        uid: data.user.id,
        email: data.user.email || '',
        name: String(prof.name || '').toUpperCase(),
        role: prof.role === 'admin' ? 'admin' : 'worker'
      };
      authStore.setUser(identity);
      useAppStore.getState().logActivity('Login', 'User logged in: ' + email);
      
      if (data.user.user_metadata?.preferences) {
        usePreferencesStore.getState().hydrateFromServer(identity.uid, data.user.user_metadata.preferences);
      }
      
      // Pull initial data in background to speed up login
      cloudPullAll().catch(e => logger.error('auth', 'login:pull', 'Background pull after login failed', e));
      
      // login_success is off by default (too noisy) — only fires if admin enables it
      triggerEventNotification('login_success', {
        title: 'User Logged In',
        body: `${email} successfully logged in.`
      }).catch(() => {});
    }
  } catch (e: any) {
    logger.warn('auth', 'login', 'Login failed', e, { email });
    useAppStore.getState().logActivity('Login Failed', 'Failed login attempt for: ' + email);
    authStore.setError(e.message || 'Login failed.');
  } finally {
    authStore.setLoading(false);
  }
}

export async function logout() {
  const authStore = useAuthStore.getState();
  try {
    sessionStorage.removeItem('mansurActiveUser');
    await supabase.auth.signOut();
    useAppStore.getState().logActivity('Logout', 'User logged out');
  } catch (e) {
    logger.error('auth', 'logout', 'Logout failed', e);
  }
  useAppStore.getState().resetStore();
  useSyncStore.getState().resetStore();
  authStore.setUser(null);
}

// Set up listener for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  const authStore = useAuthStore.getState();
  if (event === 'SIGNED_OUT') {
    authStore.setUser(null);
  } else if (session?.user) {
    // Only reload if user changed
    const curr = authStore.user;
    if (!curr || curr.uid !== session.user.id) {
      refreshSession();
    }
  }
});

export async function getAllProfiles(): Promise<any[]> {
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    logger.error('auth', 'getAllProfiles', 'Failed to fetch profiles', e);
    return [];
  }
}

export async function updateProfileRole(userId: string, newRole: 'admin' | 'worker'): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) throw error;
    return true;
  } catch (e) {
    logger.error('auth', 'updateProfileRole', 'Role update failed', e, { userId, newRole });
    return false;
  }
}

export async function toggleProfileStatus(userId: string, disable: boolean): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').update({ is_disabled: disable }).eq('id', userId);
    if (error) throw error;
    return true;
  } catch (e) {
    logger.error('auth', 'toggleProfileStatus', 'Status toggle failed', e, { userId, disable });
    return false;
  }
}

export async function createNewUser(email: string, password: string, name: string, role: 'admin' | 'worker') {
  // We use a secondary ephemeral client so that signing up does NOT mutate our local session (logging the admin out).
  const adminClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: {
      storageKey: 's_temp_admin_create',
      persistSession: false
    }
  });

  try {
    const { data, error } = await adminClient.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    
    // We update their profile to the chosen name and role
    // (A trigger might have auto-created it as 'worker', so we overwrite it. If no trigger, we insert it)
    if (data.user) {
      const { error: pErr } = await supabase.from('profiles').upsert({ 
        id: data.user.id, 
        email,
        name, 
        role 
      });
      if (pErr) logger.error('auth', 'createNewUser:setRole', 'Failed to set role', pErr, { userId: data.user.id });
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create user' };
  }
}
