import { create } from 'zustand';
import type { UserIdentity } from '../types';
import { logger } from '../lib/logger';

interface AuthState {
  user: UserIdentity | null;
  isLoading: boolean;
  error: string | null;
  
  setUser: (user: UserIdentity | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, // Strictly rely on Supabase session validation
  isLoading: true, // starts loading while session checks
  error: null,
  
  setUser: (user) => {
    try {
      if (user) {
        sessionStorage.setItem('mansurActiveUser', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('mansurActiveUser');
      }
    } catch (e) {
      logger.warn('auth', 'persistUser', 'Failed to persist user to sessionStorage', e);
    }
    set({ user });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}));
