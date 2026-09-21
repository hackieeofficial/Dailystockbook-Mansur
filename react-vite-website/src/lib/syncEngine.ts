import { supabase } from './supabase';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { useAuthStore } from '../store/useAuthStore';
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
    // We fetch data->stats to avoid downloading large extracted arrays for historical reports
    const { data: allDatesData, error: datesErr } = await supabase
      .from('daily_reports')
      .select('date_str, data->stats');

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
        cloudDates[row.date_str] = true;
        // If we don't have it locally at all, create a skeleton
        if (!localReports[row.date_str]) {
          localReports[row.date_str] = {
             extracted: null as any, // Don't create an empty array, it prevents bugs where views think they have all data
             stats: row.stats || null,
             final: [],
             _by: 'skeleton',
             _at: 0
          } as any;
        }
      });
    }

    // Identify and remove deleted reports
    Object.keys(localReports).forEach(dateStr => {
      // If it's not in cloud AND it's not pending upload, delete it
      if (!cloudDates[dateStr] && !syncStore.pendingSync[dateStr]) {
        delete localReports[dateStr];
      }
    });

    // Then overwrite with full data for recent reports
    if (Array.isArray(recentReportsData)) {
      recentReportsData.forEach(row => {
        if (!row.date_str || !row.data) return;
        if (syncStore.pendingSync[`del:${row.date_str}`]) return;
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
            const map = new Map();
            [...(state.activityLogs || []), ...row.value].forEach(log => {
              if (!map.has(log.id) || map.get(log.id).timestamp < log.timestamp) map.set(log.id, log);
            });
            nextState.activityLogs = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 1000);
          } else if (row.key === 'main_godowns' && Array.isArray(row.value)) {
            nextState.mainGodowns = row.value;
          } else if (row.key === 'global_notification_preferences') {
            useSyncStore.getState().setGlobalNotificationPrefs(row.value || {
              report_deleted: 'admin',
              zero_stock_refilled: 'all',
              login_blocked: 'admin',
              user_created: 'admin',
              report_submitted: 'none',
            });
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

    // Push converged (merged) CRDT states back to the cloud
    if (converge.length > 0) {
      logger.info('sync', 'cloudPullAll', `Converging ${converge.length} reports to cloud.`);
      converge.forEach(dateStr => {
        cloudSaveDateReportNow(dateStr, localReports[dateStr], false);
      });
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

export async function cloudSaveDateReportNow(dateStr: string, reportData: DailyReport, notify = false): Promise<{ success: boolean; error?: string }> {
  const syncStore = useSyncStore.getState();
  if (!dateStr) return { success: false, error: 'No date provided' };
  
  if (!syncStore.isCloudOnline) {
    syncStore.queuePending(dateStr);
    return { success: true }; // Queued successfully
  }
  
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
      
      // Only notify on explicit user-initiated saves (not background convergence syncs)
      if (notify) {
        triggerEventNotification('report_submitted', {
          title: 'Report Submitted',
          body: `Daily report for ${dateStr} has been saved/updated.`
        }).catch(() => {});
      }
      
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
  
  if (!syncStore.isCloudOnline) {
    syncStore.queuePending(`set:${key}`, value);
    return;
  }
  
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
      } else if (error.code === '42501') {
        // Permission denied (e.g. worker trying to update admin settings)
        // Drop it so we don't spam retries
        logger.warn('sync', 'cloudSaveSettingNow', 'Permission denied, dropping update', { key });
        syncStore.unqueuePending(`set:${key}`);
        syncStore.setCloudStatus('synced');
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

  if (!syncStore.isCloudOnline) {
    syncStore.queuePending(`del:${dateStr}`);
    return { success: true };
  }

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
      
      // Fire-and-forget — never block the delete return on notification delivery
      triggerEventNotification('report_deleted', {
        title: 'Report Deleted',
        body: `Daily report for ${dateStr} has been deleted.`
      }).catch(() => {});
      
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
          } else if (newRec.key === 'user_avatars') {
            return { userAvatars: newRec.value || {} };
          } else if (newRec.key === 'main_godowns') {
            return { mainGodowns: newRec.value || [] };
          } else if (newRec.key === 'activity_logs') {
            const map = new Map();
            [...(state.activityLogs || []), ...(newRec.value || [])].forEach(log => {
              if (!map.has(log.id) || map.get(log.id).timestamp < log.timestamp) map.set(log.id, log);
            });
            return { activityLogs: Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 1000) };
          } else if (newRec.key === 'global_notification_preferences') {
            useSyncStore.getState().setGlobalNotificationPrefs(newRec.value || {
              report_deleted: 'admin',
              zero_stock_refilled: 'all',
              login_blocked: 'admin',
              user_created: 'admin',
              report_submitted: 'none',
            });
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
      if (pendingData && pendingData.v !== undefined) {
        let currentValue = pendingData.v;
        // Dynamically fetch latest CRDT-merged state from AppStore to prevent offline-overwrites
        if (key === 'godowns') currentValue = appStore.configuredGodowns;
        else if (key === 'main_godowns') currentValue = appStore.mainGodowns;
        else if (key === 'suppliers') currentValue = appStore.suppliers;
        else if (key === 'product_master') currentValue = appStore.productMaster;
        else if (key === 'user_permissions') currentValue = appStore.userPermissions;
        else if (key === 'users') currentValue = appStore.configuredUsers;
        else if (key === 'user_avatars') currentValue = appStore.userAvatars;
        else if (key === 'activity_logs') currentValue = appStore.activityLogs;
        
        await cloudSaveSettingNow(key, currentValue);
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

export async function triggerEventNotification(eventKey: string, payload: { title: string; body: string; data?: any }): Promise<void> {
  const prefs = useSyncStore.getState().globalNotificationPrefs;
  
  const pref = prefs[eventKey];
  
  // Check if the event is globally disabled
  if (!pref || pref === 'none') {
    logger.info('sync', 'triggerEventNotification', `Notification for ${eventKey} is disabled`);
    return;
  }

  try {
    let query = supabase
      .from('profiles')
      .select('fcm_token')
      .not('fcm_token', 'is', null)
      .neq('fcm_token', '');
      
    if (pref === 'admin') {
      query = query.eq('role', 'admin');
    }

    const currentUser = useAuthStore.getState().user;
    if (currentUser?.id) {
      query = query.neq('id', currentUser.id);
    }

    const { data: users } = await query;

    if (!users || users.length === 0) return;

    const tokens = Array.from(new Set(users.map(u => u.fcm_token).filter(Boolean)));

    if (tokens.length === 0) return;

    await supabase.functions.invoke('send_fcm', {
      body: {
        tokens,
        title: payload.title,
        body: payload.body,
        data: payload.data
      }
    });
    
    logger.info('sync', 'triggerEventNotification', `Sent ${eventKey} push to ${tokens.length} users`);
  } catch (error) {
    logger.error('sync', 'triggerEventNotification', 'Failed to broadcast notification', error);
  }
}
