import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface UserPreferences {
  // Mobile Font Sizing (px)
  mobileTitleSize: number;
  mobileCategorySize: number;
  mobileQtySize: number;
  mobileQtyLabelSize: number;
  mobilePricePrimarySize: number;
  mobilePriceSecondarySize: number;
  mobileBadgeSize: number;
  mobileMetaSize: number;
  
  // Desktop Font Sizing (px)
  desktopTitleSize: number;
  desktopCategorySize: number;
  desktopQtySize: number;
  desktopQtyLabelSize: number;
  desktopPricePrimarySize: number;
  desktopPriceSecondarySize: number;
  desktopBadgeSize: number;
  desktopMetaSize: number;

  // Audio
  enableSounds: boolean;
  soundVolume: number; // 0 to 1

  // Appearance & Theme
  themeAccent: 'blue' | 'emerald' | 'slate' | 'violet';
  highContrastMode: boolean;
  reduceMotion: boolean;
  grayscaleMode: boolean;
  fontFamily: 'Plus Jakarta Sans' | 'Inter' | 'Roboto' | 'Outfit' | 'Quicksand' | 'Poppins';
  uiDensity: 'compact' | 'comfortable' | 'spacious';

  // Privacy & Data
  showCurrencySymbol: boolean;
  hideZeroBalances: boolean;
  showCategoryLabels: boolean;
  qtyAlignment: 'left' | 'center' | 'right';
  stickyHeader: boolean;
}

export const defaultPreferences: UserPreferences = {
  mobileTitleSize: 14,
  mobileCategorySize: 10,
  mobileQtySize: 16,
  mobileQtyLabelSize: 8,
  mobilePricePrimarySize: 12,
  mobilePriceSecondarySize: 9,
  mobileBadgeSize: 9,
  mobileMetaSize: 9,
  
  desktopTitleSize: 14,
  desktopCategorySize: 10,
  desktopQtySize: 16,
  desktopQtyLabelSize: 8,
  desktopPricePrimarySize: 12,
  desktopPriceSecondarySize: 9,
  desktopBadgeSize: 10,
  desktopMetaSize: 9,

  enableSounds: true,
  soundVolume: 0.5,

  themeAccent: 'blue',
  highContrastMode: false,
  reduceMotion: false,
  grayscaleMode: false,
  fontFamily: 'Plus Jakarta Sans',
  uiDensity: 'comfortable',

  showCurrencySymbol: true,
  hideZeroBalances: false,
  showCategoryLabels: true,
  qtyAlignment: 'left',
  stickyHeader: true,
};

interface PreferencesState {
  preferencesByUser: Record<string, UserPreferences>;
  getPreferences: (userId: string) => UserPreferences;
  updatePreferences: (userId: string, prefs: Partial<UserPreferences>) => void;
  hydrateFromServer: (userId: string, serverPrefs: Partial<UserPreferences>) => void;
}

let syncTimeout: any = null;

let prefsChannel: any = null;

export const initPrefsRealtime = (userId: string) => {
  if (prefsChannel) supabase.removeChannel(prefsChannel);
  prefsChannel = supabase.channel(`prefs:${userId}`);
  
  prefsChannel.on('broadcast', { event: 'prefs_update' }, (payload: any) => {
    logger.debug('store', 'usePreferencesStore', 'Received live sync preferences', payload.payload);
    usePreferencesStore.getState().hydrateFromServer(userId, payload.payload);
  }).subscribe();
};

const syncToCloud = async (_userId: string, prefs: UserPreferences) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    // Send broadcast immediately so other devices get instant update
    if (prefsChannel) {
      prefsChannel.send({ type: 'broadcast', event: 'prefs_update', payload: prefs });
    }
    
    // We store preferences in user_metadata so it persists across sessions
    await supabase.auth.updateUser({
      data: { preferences: prefs }
    });
    
    logger.debug('store', 'usePreferencesStore', 'Synced preferences to cloud');
  } catch (err) {
    logger.warn('store', 'usePreferencesStore', 'Failed to sync preferences', err);
  }
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      preferencesByUser: {},
      
      getPreferences: (userId) => {
        return get().preferencesByUser[userId] || defaultPreferences;
      },
      
      hydrateFromServer: (userId, serverPrefs) => {
        set((state) => {
          const current = state.preferencesByUser[userId] || defaultPreferences;
          return {
            preferencesByUser: {
              ...state.preferencesByUser,
              [userId]: { ...current, ...serverPrefs },
            },
          };
        });
      },

      updatePreferences: (userId, prefs) => {
        set((state) => {
          const current = state.preferencesByUser[userId] || defaultPreferences;
          const nextPrefs = { ...current, ...prefs };
          
          // Debounce cloud sync to avoid spamming Supabase API on slider drag
          clearTimeout(syncTimeout);
          syncTimeout = setTimeout(() => {
            syncToCloud(userId, nextPrefs);
          }, 1000);

          return {
            preferencesByUser: {
              ...state.preferencesByUser,
              [userId]: nextPrefs,
            },
          };
        });
      },
    }),
    {
      name: 'daily-stock-preferences-v3', // v3 clears out old sizing keys and sets new defaults
    }
  )
);

// Enable cross-tab synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'daily-stock-preferences-v3') {
      usePreferencesStore.persist.rehydrate();
    }
  });
}
