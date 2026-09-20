import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SyncState {
  isCloudOnline: boolean;
  cloudStatus: 'synced' | 'syncing' | 'loading' | 'connecting' | 'offline' | 'setup';
  saveInFlight: number;
  pullInFlight: number;
  tablesMissing: boolean;
  pendingSync: Record<string, any>;
  autoSave: boolean;
  lastSyncError: { key: string; code: string; message: string; at: string } | null;
  globalNotificationPrefs: Record<string, 'all' | 'admin' | 'none'>;

  setCloudStatus: (status: 'synced' | 'syncing' | 'loading' | 'connecting' | 'offline' | 'setup') => void;
  incrementSave: () => void;
  decrementSave: () => void;
  incrementPull: () => void;
  decrementPull: () => void;
  setTablesMissing: (missing: boolean) => void;
  queuePending: (key: string, value?: any) => void;
  unqueuePending: (key: string) => void;
  setAutoSave: (autoSave: boolean) => void;
  setSyncError: (error: { key: string; code: string; message: string; at: string } | null) => void;
  setIsCloudOnline: (online: boolean) => void;
  setGlobalNotificationPrefs: (prefs: Record<string, 'all' | 'admin' | 'none'>) => void;
  resetStore: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
  isCloudOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  cloudStatus: 'connecting',
  saveInFlight: 0,
  pullInFlight: 0,
  tablesMissing: false,
  pendingSync: {},
  autoSave: true,
  lastSyncError: null,
  globalNotificationPrefs: {
    // Security
    login_blocked: 'admin',
    user_created: 'admin',
    user_suspended: 'admin',
    user_role_changed: 'admin',
    login_success: 'none',
    // Daybook
    report_submitted: 'none',
    report_deleted: 'admin',
    report_all_deleted: 'admin',
    report_reset: 'none',
    pdf_uploaded: 'all',
    // Inventory
    zero_stock_refilled: 'all',
    // Master Data
    godown_added: 'none',
    godown_removed: 'admin',
    supplier_added: 'none',
    supplier_removed: 'admin',
    product_master_cleared: 'admin',
    // Danger Zone
    master_wipe: 'admin',
    selective_wipe: 'admin',
  },

  setCloudStatus: (status) => set({ cloudStatus: status }),
  setIsCloudOnline: (online) => set({ isCloudOnline: online }),
  setGlobalNotificationPrefs: (prefs) => set({ globalNotificationPrefs: prefs }),
  incrementSave: () => set((s) => ({ saveInFlight: s.saveInFlight + 1 })),
  decrementSave: () => set((s) => ({ saveInFlight: Math.max(0, s.saveInFlight - 1) })),
  incrementPull: () => set((s) => ({ pullInFlight: s.pullInFlight + 1 })),
  decrementPull: () => set((s) => ({ pullInFlight: Math.max(0, s.pullInFlight - 1) })),
  setTablesMissing: (missing) => set({ tablesMissing: missing }),
  
  queuePending: (key, value) => {
    set((s) => {
      const next = { ...s.pendingSync };
      if (value === undefined) {
        if (!next[key] || next[key] === true) next[key] = true;
      } else {
        next[key] = { v: value, at: Date.now() };
      }
      return { pendingSync: next };
    });
  },
  
  unqueuePending: (key) => {
    set((s) => {
      const next = { ...s.pendingSync };
      delete next[key];
      return { pendingSync: next };
    });
  },
  
  setAutoSave: (val) => set({ autoSave: val }),
  setSyncError: (err) => set({ lastSyncError: err }),
  resetStore: () => set({
    isCloudOnline: false,
    cloudStatus: 'connecting',
    saveInFlight: 0,
    pullInFlight: 0,
    tablesMissing: false,
    pendingSync: {},
    lastSyncError: null,
    // Reset prefs to defaults on logout; re-synced on next login
    globalNotificationPrefs: {
      login_blocked: 'admin',
      user_created: 'admin',
      user_suspended: 'admin',
      user_role_changed: 'admin',
      login_success: 'none',
      report_submitted: 'none',
      report_deleted: 'admin',
      report_all_deleted: 'admin',
      report_reset: 'none',
      pdf_uploaded: 'all',
      zero_stock_refilled: 'all',
      godown_added: 'none',
      godown_removed: 'admin',
      supplier_added: 'none',
      supplier_removed: 'admin',
      product_master_cleared: 'admin',
      master_wipe: 'admin',
      selective_wipe: 'admin',
    }
  })
    }),
    {
      name: 'mansur-sync-store',
      partialize: (state) => ({
        pendingSync: state.pendingSync,
        // Don't persist flight counters or online status as they are ephemeral
      }),
    }
  )
);
