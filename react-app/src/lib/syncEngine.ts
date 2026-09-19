import { supabase } from './supabase';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { mergeDailyReport, unionStrList, mergeStrMap, mergeMemory } from '../utils/sync';
import type { DailyReport } from '../types';
import { logger } from './logger';

const DS_BUILD = 'react-v1';
let _channels: any[] = [];

// Helper to determine if an error means tables are missing
function isMissingTable(err: any) {
  if (!err) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return code === 'PGRST205' || code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache');
}

export async function cloudPullAll(): Promise<{ ok: boolean; missing: boolean }> {
  const syncStore = useSyncStore.getState();
  const appStore = useAppStore.getState();
  
  syncStore.incrementPull();
  syncStore.setCloudStatus('loading');
  
  try {
    // 1. Fetch lightweight metadata for ALL reports (just so Calendar knows what exists)
    // We fetch a tiny slice of data so we know the extractedCount
    const { data: allDatesData, error: datesErr } = await supabase
      .from('daily_reports')
      .select('date_str, data->extracted');

    if (datesErr) {
      syncStore.decrementPull();
      if (isMissingTable(datesErr)) {
        syncStore.setTablesMissing(true);
        syncStore.setCloudStatus('setup');
        return { ok: false, missing: true };
      }
      syncStore.setSyncError({ key: 'pull', code: datesErr.code, message: datesErr.message, at: new Date().toISOString() });

      syncStore.setCloudStatus('offline');
      return { ok: false, missing: false };
    }

    // 2. Fetch full data ONLY for recently updated reports (last 30 days) to save RAM and bandwidth
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentReportsData } = await supabase
      .from('daily_reports')
      .select('date_str, data')
      .gte('updated_at', thirtyDaysAgo.toISOString());

    syncStore.setTablesMissing(false);
    syncStore.setSyncError(null);

    const localReports = { ...appStore.dailyReports };
    const cloudDates: Record<string, boolean> = {};
    const converge: string[] = [];

    // First populate skeleton data for CalendarView (just enough to show dots)
    if (Array.isArray(allDatesData)) {
      allDatesData.forEach(row => {
        if (!row.date_str) return;
        // If we don't have it locally at all, create a skeleton
        if (!localReports[row.date_str]) {
          localReports[row.date_str] = {
             extracted: row.extracted || [],
             final: [],
             _by: 'skeleton',
             _at: 0
          } as any;
        }
      });
    }

    // Then overwrite with full data for recent reports
    if (Array.isArray(recentReportsData)) {
      recentReportsData.forEach(row => {
        if (!row.date_str || !row.data) return;
        if (syncStore.pendingSync[`del:${row.date_str}`]) return;

        cloudDates[row.date_str] = true;
        try {
          if (localReports[row.date_str] && localReports[row.date_str]._by !== 'skeleton') {
            const mg = mergeDailyReport(localReports[row.date_str], row.data, DS_BUILD);
            localReports[row.date_str] = mg.merged;
            if (mg.localExtra) converge.push(row.date_str);
          } else {
            localReports[row.date_str] = mergeDailyReport(null, row.data, DS_BUILD).merged;
          }
        } catch (e) {
          logger.error('sync', 'cloudPullAll:merge', 'Failed to merge date report', e, { dateStr: row.date_str });
        }
      });
    }
    
    appStore.setDailyReports(localReports);

    const { data: settingsData, error: settingsErr } = await supabase
      .from('app_settings')
      .select('key, value');

    if (!settingsErr && Array.isArray(settingsData)) {
      useAppStore.setState(state => {
        const nextState: any = {};
        settingsData.forEach(row => {
          if (row.key === 'godowns' && Array.isArray(row.value)) {
            const res = unionStrList(state.configuredGodowns, row.value);
            nextState.configuredGodowns = res.list;
          } else if (row.key === 'godown_aliases' && row.value) {
            const res = mergeStrMap(state.godownAliases, row.value);
            nextState.godownAliases = res.map;
          } else if (row.key === 'product_master' && row.value) {
            const res = mergeMemory(state.productMaster, row.value);
            nextState.productMaster = res.map;
          } else if (row.key === 'users' && Array.isArray(row.value)) {
            nextState.configuredUsers = row.value;
          } else if (row.key === 'suppliers' && Array.isArray(row.value)) {
            const res = unionStrList(state.suppliers, row.value);
            nextState.suppliers = res.list;
          } else if (row.key === 'user_permissions') {
            nextState.userPermissions = row.value || {};
          } else if (row.key === 'user_avatars') {
            nextState.userAvatars = row.value || {};
          } else if (row.key === 'activity_logs' && Array.isArray(row.value)) {
            // We just take the remote one for now since it's an append-only sequence driven by clients, 
            // but a merge by id/timestamp would be better if needed. We'll simply set it.
            nextState.activityLogs = row.value;
          } else if (row.key === 'main_godowns' && Array.isArray(row.value)) {
            nextState.mainGodowns = row.value;
          }
        });
        return nextState;
      });
    }

    // Also pull live users from profiles table instead of legacy app_settings users
    const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (profilesData) {
      useAppStore.setState({ configuredUsers: profilesData });
    }

    syncStore.decrementPull();
    syncStore.setCloudStatus('synced');
    return { ok: true, missing: false };
    
  } catch (err: any) {
    logger.error('sync', 'cloudPullAll', 'Pull failed with unexpected error', err);
    syncStore.decrementPull();
    syncStore.setCloudStatus('offline');
    return { ok: false, missing: false };
  }
}

export async function cloudSaveDateReportNow(dateStr: string, reportData: DailyReport): Promise<{ success: boolean; error?: string }> {
  const syncStore = useSyncStore.getState();
  if (!dateStr) return { success: false, error: 'No date provided' };
  
  syncStore.incrementSave();
  syncStore.setCloudStatus('syncing');
  
  try {
    const payload = { ...reportData, _by: DS_BUILD, _at: Date.now() };
    const { error } = await supabase.from('daily_reports')
      .upsert({ date_str: dateStr, data: payload, updated_at: new Date().toISOString() }, { onConflict: 'date_str' });
      
    syncStore.decrementSave();
    
    if (error) {
      if (isMissingTable(error)) {
        syncStore.setTablesMissing(true);
        syncStore.setCloudStatus('setup');
      } else {
        syncStore.setSyncError({ key: dateStr, code: error.code, message: error.message, at: new Date().toISOString() });
        syncStore.queuePending(dateStr);
  
        syncStore.setCloudStatus('offline');
      }
      return { success: false, error: error.message };
    } else {
      syncStore.unqueuePending(dateStr);
      syncStore.setSyncError(null);

      syncStore.setCloudStatus('synced');
      return { success: true };
    }
  } catch (err: any) {
    logger.error('sync', 'cloudSaveDateReport', 'Save failed', err, { dateStr });
    syncStore.decrementSave();
    syncStore.queuePending(dateStr);
    syncStore.setCloudStatus('offline');
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function cloudSaveSettingNow(key: string, value: any) {
  const syncStore = useSyncStore.getState();
  
  syncStore.incrementSave();
  syncStore.setCloudStatus('syncing');
  
  try {
    const { error } = await supabase.from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      
    syncStore.decrementSave();
    
    if (error) {
      if (isMissingTable(error)) {
        syncStore.setTablesMissing(true);
        syncStore.setCloudStatus('setup');
      } else {
        syncStore.setSyncError({ key: `set:${key}`, code: error.code, message: error.message, at: new Date().toISOString() });
        syncStore.queuePending(`set:${key}`, value);
  
        syncStore.setCloudStatus('offline');
      }
    } else {
      syncStore.unqueuePending(`set:${key}`);
      syncStore.setSyncError(null);

      syncStore.setCloudStatus('synced');
    }
  } catch (err: any) {
    logger.error('sync', 'cloudSaveSetting', 'Setting save failed', err, { key });
    syncStore.decrementSave();
    syncStore.queuePending(`set:${key}`, value);
    syncStore.setIsCloudOnline(false);
    syncStore.setCloudStatus('offline');
  }
}

export async function cloudDeleteDateReport(dateStr: string): Promise<{ success: boolean; error?: string }> {
  const syncStore = useSyncStore.getState();
  if (!dateStr) return { success: false, error: 'No date provided' };

  syncStore.incrementSave();
  syncStore.setCloudStatus('syncing');

  try {
    const { error } = await supabase.from('daily_reports').delete().eq('date_str', dateStr);
    syncStore.decrementSave();
    
    if (error) {
      syncStore.queuePending(`del:${dateStr}`);

      syncStore.setCloudStatus('offline');
      return { success: false, error: error.message };
    } else {
      syncStore.unqueuePending(`del:${dateStr}`);

      syncStore.setCloudStatus('synced');
      return { success: true };
    }
  } catch (err: any) {
    logger.error('sync', 'cloudDeleteDateReport', 'Delete failed', err, { dateStr });
    syncStore.decrementSave();
    syncStore.queuePending(`del:${dateStr}`);
    syncStore.setIsCloudOnline(false);
    syncStore.setCloudStatus('offline');
    return { success: false, error: err.message || 'Network error' };
  }
}

export function initCloudRealtime() {
  _channels.forEach(ch => supabase.removeChannel(ch));
  _channels = [];

    const repCh = supabase.channel('public:daily_reports')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, payload => {
      const oldRec = payload.old as any;
      const newRec = payload.new as any;
      
      if (payload.eventType === 'DELETE' && oldRec && oldRec.date_str) {
        useAppStore.setState(state => {
          const next = { ...state.dailyReports };
          delete next[oldRec.date_str];
          return { dailyReports: next };
        });
      } else if (newRec && newRec.date_str) {
        const ds = newRec.date_str;
        useAppStore.setState(state => {
          const local = state.dailyReports[ds];
          const mg = mergeDailyReport(local, newRec.data, DS_BUILD);
          
          if (mg.localExtra) {
            // converge push if needed
            cloudSaveDateReportNow(ds, mg.merged);
          }
          return { dailyReports: { ...state.dailyReports, [ds]: mg.merged } };
        });
      }
    })
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        logger.error('sync', 'realtime:daily_reports', 'Channel error', err);
      } else if (status === 'TIMED_OUT') {
        logger.warn('sync', 'realtime:daily_reports', 'Channel timed out');
      }
    });

  const setCh = supabase.channel('public:app_settings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, payload => {
      const newRec = payload.new as any;
      if (newRec && newRec.key) {
        useAppStore.setState(state => {
          if (newRec.key === 'godowns') {
            const res = unionStrList(state.configuredGodowns, newRec.value);
            return { configuredGodowns: res.list };
          } else if (newRec.key === 'godown_aliases') {
            const res = mergeStrMap(state.godownAliases, newRec.value);
            return { godownAliases: res.map };
          } else if (newRec.key === 'product_master') {
            const res = mergeMemory(state.productMaster, newRec.value);
            return { productMaster: res.map };
          } else if (newRec.key === 'suppliers') {
            const res = unionStrList(state.suppliers, newRec.value);
            return { suppliers: res.list };
          } else if (newRec.key === 'user_permissions') {
            return { userPermissions: newRec.value || {} };
          } else if (newRec.key === 'main_godowns') {
            return { mainGodowns: newRec.value || [] };
          }
          return {};
        });
      }
    })
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        logger.error('sync', 'realtime:app_settings', 'Channel error', err);
      } else if (status === 'TIMED_OUT') {
        logger.warn('sync', 'realtime:app_settings', 'Channel timed out');
      }
    });

  const profCh = supabase.channel('public:profiles')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
      // Fetch full list on any change to keep it simple and perfectly sorted
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (data) {
        useAppStore.setState({ configuredUsers: data });
      }
    })
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        logger.error('sync', 'realtime:profiles', 'Channel error', err);
      } else if (status === 'TIMED_OUT') {
        logger.warn('sync', 'realtime:profiles', 'Channel timed out');
      }
    });

  _channels.push(repCh, setCh, profCh);
}

export async function flushPending() {
  const syncStore = useSyncStore.getState();
  const appStore = useAppStore.getState();
  const keys = Object.keys(syncStore.pendingSync);
  
  if (!keys.length || !navigator.onLine) return;
  
  for (const k of keys) {
    if (k.startsWith('del:')) {
      const ds = k.slice(4);
      if (appStore.dailyReports[ds]) {
        syncStore.unqueuePending(k); // Local has it again, so abort deletion
        continue;
      }
      await cloudDeleteDateReport(ds);
    } else if (k.startsWith('set:')) {
      const key = k.slice(4);
      const pendingData = syncStore.pendingSync[k];
      if (pendingData?.v) {
        await cloudSaveSettingNow(key, pendingData.v);
      } else {
        syncStore.unqueuePending(k);
      }
    } else {
      const rep = appStore.dailyReports[k];
      if (rep) {
        await cloudSaveDateReportNow(k, rep);
      } else {
        syncStore.unqueuePending(k);
      }
    }
  }
}
