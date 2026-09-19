import { create } from 'zustand';

interface SyncState {
  isCloudOnline: boolean;
  cloudStatus: 'synced' | 'syncing' | 'loading' | 'connecting' | 'offline' | 'setup';
  saveInFlight: number;
  pullInFlight: number;
  tablesMissing: boolean;
  pendingSync: Record<string, any>;
  autoSave: boolean;
  lastSyncError: { key: string; code: string; message: string; at: string } | null;

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
  resetStore: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isCloudOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  cloudStatus: 'connecting',
  saveInFlight: 0,
  pullInFlight: 0,
  tablesMissing: false,
  pendingSync: {},
  autoSave: true,
  lastSyncError: null,

  setCloudStatus: (status) => set({ cloudStatus: status }),
  setIsCloudOnline: (online) => set({ isCloudOnline: online }),
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
    lastSyncError: null
  })
}));
