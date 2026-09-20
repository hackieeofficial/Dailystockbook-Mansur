import { create } from 'zustand';
import type { DailyReport, ProductMasterEntry, Profile, ActivityLog } from '../types';
import { logger } from '../lib/logger';

export interface AppState {
  dailyReports: Record<string, DailyReport>;
  configuredGodowns: string[];
  mainGodowns: string[];
  godownAliases: Record<string, string>;
  productMaster: Record<string, ProductMasterEntry>;
  configuredUsers: Profile[];
  activeDate: string | null;
  zeroStockSelectedDate: string;
  
  // Actions
  setDailyReports: (reports: Record<string, DailyReport>) => void;
  updateDailyReport: (dateStr: string, report: DailyReport) => void;
  updateDailyReportLocal: (dateStr: string, report: DailyReport) => void;
  deleteDailyReport: (dateStr: string) => void;
  deleteDailyReportLocal: (dateStr: string) => void;
  setConfiguredGodowns: (list: string[]) => void;
  setMainGodowns: (list: string[]) => void;
  toggleMainGodown: (name: string) => void;
  renameGodown: (oldName: string, newName: string) => void;
  removeGodown: (name: string) => void;
  setGodownAliases: (aliases: Record<string, string>) => void;
  updateGodownAliases: (oldName: string, newName: string) => void;
  removeGodownAlias: (alias: string) => void;
  reorderGodown: (fromIndex: number, toIndex: number) => void;
  setProductMaster: (master: Record<string, ProductMasterEntry>) => void;
  clearProductMaster: () => void;
  updateProductMasterEntry: (id: string, updates: Partial<ProductMasterEntry>) => void;
  setConfiguredUsers: (users: Profile[]) => void;
  setActiveDate: (dateStr: string | null) => void;
  setZeroStockSelectedDate: (date: string) => void;
  
  // Suppliers and Refills
  suppliers: string[];
  addSupplier: (name: string) => void;
  renameSupplier: (oldName: string, newName: string) => void;
  removeSupplier: (name: string) => void;
  clearSuppliers: () => void;
  markItemForRefill: (dateStr: string, itemId: string, supplier: string) => void;
  clearRefillStatus: (dateStr: string, itemId: string) => void;

  userPermissions: Record<string, string[]>;
  setUserPermissions: (userId: string, permissions: string[]) => void;
  
  activityLogs: ActivityLog[];
  logActivity: (action: string, details: string) => void;
  setActivityLogs: (logs: ActivityLog[]) => void;
  
  userAvatars: Record<string, string>;
  setUserAvatars: (avatars: Record<string, string>) => void;
  setUserAvatar: (uid: string, base64: string) => void;
  
  resetStore: () => void;
}

const initialState = {
  dailyReports: {},
  configuredGodowns: ['Main Store'],
  mainGodowns: ['Main Store'],
  godownAliases: {},
  productMaster: {},
  configuredUsers: [],
  activeDate: null,
  zeroStockSelectedDate: '',
  activityLogs: [],
  userAvatars: {},
  suppliers: [],
  userPermissions: {},
};

export const useAppStore = create<AppState>()((set) => {
  return {
    ...initialState,
    
    resetStore: () => set(initialState),

    setDailyReports: (reports) => {
      set({ dailyReports: reports });
    },
    updateDailyReport: (dateStr, report) => {
      set((state) => {
        const stats = report.extracted ? {
          totalSkus: report.extracted.length,
          processedSkus: report.extracted.filter(item => item.processed).length,
          zeroStockSkus: report.extracted.filter(item => item.balanceQty <= 0).length
        } : report.stats;
        
        const nextReport = { ...report, stats };
        const next = { ...state.dailyReports, [dateStr]: nextReport };
        import('../lib/syncEngine').then(({ cloudSaveDateReportNow }) => {
          // notify=true: this is the primary user-triggered save action
          cloudSaveDateReportNow(dateStr, nextReport, true);
        });
        return { dailyReports: next };
      });
    },
    updateDailyReportLocal: (dateStr, report) => {
      set((state) => {
        const stats = report.extracted ? {
          totalSkus: report.extracted.length,
          processedSkus: report.extracted.filter(item => item.processed).length,
          zeroStockSkus: report.extracted.filter(item => item.balanceQty <= 0).length
        } : report.stats;
        
        return { dailyReports: { ...state.dailyReports, [dateStr]: { ...report, stats } } };
      });
    },
    deleteDailyReport: (dateStr) => {
      set((state) => {
        const next = { ...state.dailyReports };
        delete next[dateStr];
        import('../lib/syncEngine').then(({ cloudDeleteDateReport }) => {
          cloudDeleteDateReport(dateStr);
        });
        return { dailyReports: next };
      });
    },
    deleteDailyReportLocal: (dateStr) => {
      set((state) => {
        const next = { ...state.dailyReports };
        delete next[dateStr];
        return { dailyReports: next };
      });
    },
    setConfiguredGodowns: (list) => {
      set({ configuredGodowns: list });
      import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
        cloudSaveSettingNow('godowns', list);
      });
    },
    setMainGodowns: (list) => {
      set({ mainGodowns: list });
      import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
        cloudSaveSettingNow('main_godowns', list);
      });
    },
    toggleMainGodown: (name) => {
      set((state) => {
        const current = state.mainGodowns || [];
        const next = current.includes(name) 
          ? current.filter((g: string) => g !== name)
          : [...current, name];
        
        import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
          cloudSaveSettingNow('main_godowns', next);
        });
        return { mainGodowns: next };
      });
    },
    renameGodown: (oldName, newName) => {
      set((state) => {
        const idx = state.configuredGodowns.indexOf(oldName);
        if (idx === -1 || state.configuredGodowns.includes(newName)) return state;
        
        const nextGodowns = [...state.configuredGodowns];
        nextGodowns[idx] = newName;
        
        const nextMain = state.mainGodowns?.map(g => g === oldName ? newName : g) || [];
        
        // Deep traverse productMaster
        const nextProductMaster = { ...state.productMaster };
        let pmChanged = false;
        const nowIso = new Date().toISOString();
        Object.keys(nextProductMaster).forEach(k => {
          const entry = { ...nextProductMaster[k] };
          if (entry.godown === oldName) {
            entry.godown = newName;
            entry.refillAt = nowIso;
            nextProductMaster[k] = entry;
            pmChanged = true;
          }
        });

        const nextAliases = { ...state.godownAliases };
        let aliasesChanged = false;
        Object.keys(nextAliases).forEach(alias => {
          if (nextAliases[alias] === oldName) {
            nextAliases[alias] = newName;
            aliasesChanged = true;
          }
        });

        // Deep traverse dailyReports
        const nextReports = { ...state.dailyReports };
        const reportsToSync: string[] = [];
        
        Object.keys(nextReports).forEach(dateStr => {
          const report = { ...nextReports[dateStr] };
          let changed = false;
          
          if (report.extracted) {
            report.extracted = report.extracted.map(item => {
              let updated = false;
              let nextItem = { ...item };
              if (nextItem.godown === oldName) { nextItem.godown = newName; updated = true; }
              if (nextItem.processedGodown === oldName) { nextItem.processedGodown = newName; updated = true; }
              if (updated) { 
                changed = true; 
                nextItem.decidedAt = Date.now(); 
              }
              return updated ? nextItem : item;
            });
          }
          if (report.final) {
            report.final = report.final.map(item => {
              if (item.godown === oldName) { changed = true; return { ...item, godown: newName, updatedAt: Date.now() }; }
              return item;
            });
          }
          if (changed) {
            report._at = Date.now();
            nextReports[dateStr] = report;
            reportsToSync.push(dateStr);
          }
        });
        import('../lib/syncEngine').then(({ cloudSaveSettingNow, cloudSaveDateReportNow }) => {
          cloudSaveSettingNow('godowns', nextGodowns);
          cloudSaveSettingNow('main_godowns', nextMain);
          if (pmChanged) cloudSaveSettingNow('product_master', nextProductMaster);
          if (aliasesChanged) cloudSaveSettingNow('godown_aliases', nextAliases);
          reportsToSync.forEach(d => cloudSaveDateReportNow(d, nextReports[d]));
        });
        
        return { 
          configuredGodowns: nextGodowns,
          mainGodowns: nextMain,
          productMaster: nextProductMaster,
          godownAliases: nextAliases,
          dailyReports: nextReports
        };
      });
    },
    removeGodown: (name) => {
      set((state) => {
        if (!state.configuredGodowns.includes(name)) return state;
        
        const nextGodowns = state.configuredGodowns.filter(g => g !== name);
        const nextMain = state.mainGodowns?.filter(g => g !== name) || [];
        
        const nextProductMaster = { ...state.productMaster };
        let pmChanged = false;
        const nowIso = new Date().toISOString();
        Object.keys(nextProductMaster).forEach(k => {
          const entry = { ...nextProductMaster[k] };
          if (entry.godown === name) {
            entry.godown = '';
            entry.refillAt = nowIso;
            nextProductMaster[k] = entry;
            pmChanged = true;
          }
        });

        const nextAliases = { ...state.godownAliases };
        let aliasesChanged = false;
        Object.keys(nextAliases).forEach(alias => {
          if (nextAliases[alias] === name) {
            delete nextAliases[alias];
            aliasesChanged = true;
          }
        });

        const nextReports = { ...state.dailyReports };
        const reportsToSync: string[] = [];
        
        Object.keys(nextReports).forEach(dateStr => {
          const report = { ...nextReports[dateStr] };
          let changed = false;
          
          if (report.extracted) {
            report.extracted = report.extracted.map(item => {
              let updated = false;
              let nextItem = { ...item };
              if (nextItem.godown === name) { nextItem.godown = ''; updated = true; }
              if (nextItem.processedGodown === name) { nextItem.processedGodown = ''; updated = true; }
              if (updated) { 
                changed = true; 
                nextItem.decidedAt = Date.now();
              }
              return updated ? nextItem : item;
            });
          }
          if (report.final) {
            report.final = report.final.map(item => {
              if (item.godown === name) { changed = true; return { ...item, godown: '', updatedAt: Date.now() }; }
              return item;
            });
          }
          if (changed) {
            report._at = Date.now();
            nextReports[dateStr] = report;
            reportsToSync.push(dateStr);
          }
        });
        
        import('../lib/syncEngine').then(({ cloudSaveSettingNow, cloudSaveDateReportNow }) => {
          cloudSaveSettingNow('godowns', nextGodowns);
          cloudSaveSettingNow('main_godowns', nextMain);
          if (pmChanged) cloudSaveSettingNow('product_master', nextProductMaster);
          if (aliasesChanged) cloudSaveSettingNow('godown_aliases', nextAliases);
          reportsToSync.forEach(d => cloudSaveDateReportNow(d, nextReports[d]));
        });
        
        return { 
          configuredGodowns: nextGodowns,
          mainGodowns: nextMain,
          productMaster: nextProductMaster,
          godownAliases: nextAliases,
          dailyReports: nextReports
        };
      });
    },
    setGodownAliases: (aliases) => {
      set({ godownAliases: aliases });
      import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
        cloudSaveSettingNow('godown_aliases', aliases);
      });
    },
    updateGodownAliases: (oldName, newName) => {
      set((state) => {
        const next = { ...state.godownAliases };
        next[oldName] = newName;
        Object.keys(next).forEach(k => {
          if (next[k] === oldName) next[k] = newName;
        });
        import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
          cloudSaveSettingNow('godown_aliases', next);
        });
        return { godownAliases: next };
      });
    },
    removeGodownAlias: (alias) => {
      set((state) => {
        const next = { ...state.godownAliases };
        delete next[alias];
        import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
          cloudSaveSettingNow('godown_aliases', next);
        });
        return { godownAliases: next };
      });
    },
    reorderGodown: (fromIndex, toIndex) => {
      set((state) => {
        const next = [...state.configuredGodowns];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
          cloudSaveSettingNow('godowns', next);
        });
        return { configuredGodowns: next };
      });
    },
    setProductMaster: (master) => {
      set({ productMaster: master });
      import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
        cloudSaveSettingNow('product_master', master);
      });
    },
    clearProductMaster: () => {
      set({ productMaster: {} });
      import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
        cloudSaveSettingNow('product_master', {});
      });
    },
    updateProductMasterEntry: (id, updates) => {
      set((state) => {
        const next = { ...state.productMaster };
        next[id] = { ...next[id], ...updates };
        import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
          cloudSaveSettingNow('product_master', next);
        });
        return { productMaster: next };
      });
    },
    setConfiguredUsers: (users) => {
      set({ configuredUsers: users });
    },
    setActiveDate: (dateStr) => set({ activeDate: dateStr }),
    setZeroStockSelectedDate: (date) => set({ zeroStockSelectedDate: date }),
    
    // Removed redundant initialization
    setUserPermissions: (userId, permissions) => {
      set((state) => {
        const next = { ...state.userPermissions, [userId]: permissions };
        import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
          cloudSaveSettingNow('user_permissions', next);
        });
        return { userPermissions: next };
      });
    },
    
    setActivityLogs: (logs) => set({ activityLogs: logs }),
    
    setUserAvatars: (avatars) => set({ userAvatars: avatars }),
    setUserAvatar: (uid, base64) => {
      set((state) => {
        const next = { ...state.userAvatars, [uid]: base64 };
        import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
          cloudSaveSettingNow('user_avatars', next);
        });
        return { userAvatars: next };
      });
    },

    logActivity: (action, details) => {
      // Fetch user asynchronously to avoid circular dependency in zustand stores, 
      // then update the state with the correct user details.
      import('./useAuthStore').then(({ useAuthStore }) => {
        const user = useAuthStore.getState().user;
        const userName = user?.name || 'Unknown';
        const userEmail = user?.email || 'unknown@example.com';
        
        set((state) => {
          const newLog: ActivityLog = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            timestamp: Date.now(),
            userName,
            userEmail,
            action,
            details
          };

          const next = [newLog, ...state.activityLogs].slice(0, 1000); // keep max 1000 logs

          import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
            cloudSaveSettingNow('activityLogs', next);
          });
          
          return { activityLogs: next };
        });
      }).catch(e => {
        logger.warn('store', 'logActivity', 'Failed to lazy load auth store', e);
      });
    },

    addSupplier: (name) => {
      set((state) => {
        if (state.suppliers.includes(name)) return state;
        const next = [...state.suppliers, name];
        import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
          cloudSaveSettingNow('suppliers', next);
        });
        return { suppliers: next };
      });
    },
    
    renameSupplier: (oldName, newName) => {
      set((state) => {
        const idx = state.suppliers.indexOf(oldName);
        if (idx === -1 || state.suppliers.includes(newName)) return state;
        
        const nextSuppliers = [...state.suppliers];
        nextSuppliers[idx] = newName;
        
        // Deep traverse dailyReports to update assignedSupplier on ORDERED items
        const nextReports = { ...state.dailyReports };
        const reportsToSync: string[] = [];
        
        Object.keys(nextReports).forEach(dateStr => {
          const report = { ...nextReports[dateStr] };
          let changed = false;
          
          if (report.extracted) {
            report.extracted = report.extracted.map(item => {
              if (item.assignedSupplier === oldName) { changed = true; return { ...item, assignedSupplier: newName, decidedAt: Date.now() }; }
              return item;
            });
          }
          if (changed) {
            report._at = Date.now();
            nextReports[dateStr] = report;
            reportsToSync.push(dateStr);
          }
        });

        import('../lib/syncEngine').then(({ cloudSaveSettingNow, cloudSaveDateReportNow }) => {
          cloudSaveSettingNow('suppliers', nextSuppliers);
          reportsToSync.forEach(d => cloudSaveDateReportNow(d, nextReports[d]));
        });
        
        return { 
          suppliers: nextSuppliers,
          dailyReports: nextReports
        };
      });
    },

    removeSupplier: (name) => {
      set((state) => {
        if (!state.suppliers.includes(name)) return state;
        const nextSuppliers = state.suppliers.filter(s => s !== name);
        
        // Deep traverse dailyReports to clear assignedSupplier from ORDERED items
        const nextReports = { ...state.dailyReports };
        const reportsToSync: string[] = [];
        
        Object.keys(nextReports).forEach(dateStr => {
          const report = { ...nextReports[dateStr] };
          let changed = false;
          
          if (report.extracted) {
            report.extracted = report.extracted.map(item => {
              if (item.assignedSupplier === name) { changed = true; return { ...item, assignedSupplier: undefined, decidedAt: Date.now() }; }
              return item;
            });
          }
          if (changed) {
            report._at = Date.now();
            nextReports[dateStr] = report;
            reportsToSync.push(dateStr);
          }
        });

        import('../lib/syncEngine').then(({ cloudSaveSettingNow, cloudSaveDateReportNow }) => {
          cloudSaveSettingNow('suppliers', nextSuppliers);
          reportsToSync.forEach(d => cloudSaveDateReportNow(d, nextReports[d]));
        });
        
        return { 
          suppliers: nextSuppliers,
          dailyReports: nextReports
        };
      });
    },

    clearSuppliers: () => {
      set({ suppliers: [] });
      import('../lib/syncEngine').then(({ cloudSaveSettingNow }) => {
        cloudSaveSettingNow('suppliers', []);
      });
    },
    
    markItemForRefill: (dateStr, itemId, supplier) => {
      import('./useAuthStore').then(({ useAuthStore }) => {
        set((state) => {
          const report = state.dailyReports[dateStr];
          if (!report) return state;
          
          const user = useAuthStore.getState().user;
          const fallbackName = user ? user.name : (state.configuredUsers[0]?.name || 'Unknown');
          const fallbackId = user ? user.id : (state.configuredUsers[0]?.id || 'unknown');

          const nextReport = { ...report, extracted: [...report.extracted] };
          const itemIdx = nextReport.extracted.findIndex(i => i.id === itemId);
          if (itemIdx >= 0) {
            nextReport.extracted[itemIdx] = {
              ...nextReport.extracted[itemIdx],
              refillStatus: 'ORDERED',
              decisionType: 'ORDERED',
              processed: true,
              assignedSupplier: supplier,
              refillBy: fallbackName,
              refillById: fallbackId,
              decidedAt: Date.now()
            };
          }
          
          const stats = nextReport.extracted ? {
            totalSkus: nextReport.extracted.length,
            processedSkus: nextReport.extracted.filter(item => item.processed).length,
            zeroStockSkus: nextReport.extracted.filter(item => item.balanceQty <= 0).length
          } : nextReport.stats;
          nextReport.stats = stats;
          nextReport._at = Date.now();
          const nextReports = { ...state.dailyReports, [dateStr]: nextReport };
          import('../lib/syncEngine').then(({ cloudSaveDateReportNow, triggerEventNotification }) => {
            cloudSaveDateReportNow(dateStr, nextReport);
            triggerEventNotification('zero_stock_refilled', {
              title: 'Stock Ordered',
              body: `Item ${itemId} was marked as ordered from ${supplier}.`
            });
          });
          return { dailyReports: nextReports };
        });
      });
    },
    
    clearRefillStatus: (dateStr, itemId) => {
      set((state) => {
        const report = state.dailyReports[dateStr];
        if (!report) return state;
        
        const nextReport = { ...report, extracted: [...report.extracted] };
        const itemIdx = nextReport.extracted.findIndex(i => i.id === itemId);
        if (itemIdx >= 0) {
          const newItem = { ...nextReport.extracted[itemIdx] };
          newItem.refillStatus = null;
          newItem.decisionType = null;
          delete newItem.assignedSupplier;
          delete newItem.refillBy;
          delete newItem.refillById;
          newItem.decidedAt = Date.now(); // Update timestamp so the "undo" action wins in sync
          delete newItem.processedGodown;
          newItem.processed = false;
          nextReport.extracted[itemIdx] = newItem;
        }
        
        const stats = nextReport.extracted ? {
          totalSkus: nextReport.extracted.length,
          processedSkus: nextReport.extracted.filter(item => item.processed).length,
          zeroStockSkus: nextReport.extracted.filter(item => item.balanceQty <= 0).length
        } : nextReport.stats;
        nextReport.stats = stats;
        nextReport._at = Date.now();
        const nextReports = { ...state.dailyReports, [dateStr]: nextReport };
        import('../lib/syncEngine').then(({ cloudSaveDateReportNow }) => {
          cloudSaveDateReportNow(dateStr, nextReport);
        });
        return { dailyReports: nextReports };
      });
    }
  };
});
