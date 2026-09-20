import React from 'react';
import { useSyncStore } from '../store/useSyncStore';
import { cloudSaveSettingNow } from '../lib/syncEngine';
import {
  Bell, ShieldAlert, FileText, Trash2, Upload, RotateCcw, UserX,
  UserCheck, Package, Store, Truck, Users, LogIn, Zap, ChevronDown
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// MASTER EVENT CATALOGUE
// Every event that can send a push notification across the entire app
// is defined here. To add a new event, just add it to this list and
// call triggerEventNotification(key, ...) in the relevant code path.
// ─────────────────────────────────────────────────────────────────────────────

interface NotifEventDef {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  defaultAudience: 'all' | 'admin' | 'none';
  warning?: string; // shown if potentially noisy
}

const NOTIFICATION_EVENTS: NotifEventDef[] = [
  // ── SECURITY ──────────────────────────────────────────────────────────────
  {
    key: 'login_blocked',
    label: 'Login Blocked',
    description: 'Fires when a disabled/suspended account tries to log in.',
    icon: <UserX size={15} />,
    category: 'Security',
    defaultAudience: 'admin',
  },
  {
    key: 'user_created',
    label: 'New User Registered',
    description: 'Fires when a brand-new user signs into the system for the first time.',
    icon: <UserCheck size={15} />,
    category: 'Security',
    defaultAudience: 'admin',
  },
  {
    key: 'user_suspended',
    label: 'User Suspended / Enabled',
    description: 'Fires when an admin toggles a user\'s active/suspended status.',
    icon: <ShieldAlert size={15} />,
    category: 'Security',
    defaultAudience: 'admin',
  },
  {
    key: 'user_role_changed',
    label: 'User Role Changed',
    description: 'Fires when an admin promotes or demotes a user (worker ↔ admin).',
    icon: <Users size={15} />,
    category: 'Security',
    defaultAudience: 'admin',
  },
  {
    key: 'login_success',
    label: 'Successful Login',
    description: 'Fires every time any user successfully logs in.',
    icon: <LogIn size={15} />,
    category: 'Security',
    defaultAudience: 'none',
    warning: 'Noisy — fires on every login.',
  },

  // ── DAYBOOK / REPORTS ─────────────────────────────────────────────────────
  {
    key: 'report_submitted',
    label: 'Report Saved',
    description: 'Fires when a daybook report is saved or updated by a user.',
    icon: <FileText size={15} />,
    category: 'Daybook',
    defaultAudience: 'none',
    warning: 'Can be noisy — fires on every save.',
  },
  {
    key: 'report_deleted',
    label: 'Report Deleted',
    description: 'Fires when a single daybook sheet is deleted.',
    icon: <Trash2 size={15} />,
    category: 'Daybook',
    defaultAudience: 'admin',
  },
  {
    key: 'report_all_deleted',
    label: 'All Reports Deleted',
    description: 'Fires when the "Delete All Sheets" action is executed.',
    icon: <Trash2 size={15} />,
    category: 'Daybook',
    defaultAudience: 'admin',
  },
  {
    key: 'pdf_uploaded',
    label: 'PDF Uploaded',
    description: 'Fires when a new daily stock PDF is uploaded and parsed.',
    icon: <Upload size={15} />,
    category: 'Daybook',
    defaultAudience: 'admin',
  },
  {
    key: 'report_reset',
    label: 'Report Reset',
    description: 'Fires when a user resets all items on a daybook sheet.',
    icon: <RotateCcw size={15} />,
    category: 'Daybook',
    defaultAudience: 'none',
    warning: 'Can be noisy on busy days.',
  },
  {
    key: 'pdf_uploaded',
    label: 'PDF Uploaded & Parsed',
    description: 'Fires when a user uploads and parses a stock PDF.',
    icon: <Upload size={15} />,
    category: 'Daybook',
    defaultAudience: 'all',
  },

  // ── ZERO STOCK / INVENTORY ────────────────────────────────────────────────
  {
    key: 'zero_stock_refilled',
    label: 'Zero Stock Item Ordered',
    description: 'Fires when a zero stock item is marked as ordered from a supplier.',
    icon: <Package size={15} />,
    category: 'Inventory',
    defaultAudience: 'all',
  },

  // ── MASTER DATA ───────────────────────────────────────────────────────────
  {
    key: 'godown_added',
    label: 'Godown Added',
    description: 'Fires when a new godown/store location is added.',
    icon: <Store size={15} />,
    category: 'Master Data',
    defaultAudience: 'none',
  },
  {
    key: 'godown_removed',
    label: 'Godown Removed',
    description: 'Fires when a godown/store location is removed.',
    icon: <Store size={15} />,
    category: 'Master Data',
    defaultAudience: 'admin',
  },
  {
    key: 'supplier_added',
    label: 'Supplier Added',
    description: 'Fires when a new supplier is added to the system.',
    icon: <Truck size={15} />,
    category: 'Master Data',
    defaultAudience: 'none',
  },
  {
    key: 'supplier_removed',
    label: 'Supplier Removed',
    description: 'Fires when a supplier is removed from the system.',
    icon: <Truck size={15} />,
    category: 'Master Data',
    defaultAudience: 'admin',
  },
  {
    key: 'product_master_cleared',
    label: 'Product Cache Cleared',
    description: 'Fires when the product master cache is wiped.',
    icon: <Zap size={15} />,
    category: 'Master Data',
    defaultAudience: 'admin',
  },

  // ── DANGER ZONE ───────────────────────────────────────────────────────────
  {
    key: 'master_wipe',
    label: 'Master Wipe Executed',
    description: 'Fires when a full system master wipe is executed. Critical alert.',
    icon: <ShieldAlert size={15} />,
    category: 'Danger Zone',
    defaultAudience: 'admin',
  },
  {
    key: 'selective_wipe',
    label: 'Selective Wipe Executed',
    description: 'Fires when a selective data wipe is performed.',
    icon: <ShieldAlert size={15} />,
    category: 'Danger Zone',
    defaultAudience: 'admin',
  },
];

const CATEGORIES = [...new Set(NOTIFICATION_EVENTS.map(e => e.category))];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; badge: string; header: string }> = {
  'Security':    { bg: 'bg-rose-50',   border: 'border-rose-200',   badge: 'bg-rose-100 text-rose-700',   header: 'text-rose-800' },
  'Daybook':     { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',   header: 'text-blue-800' },
  'Inventory':   { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700', header: 'text-amber-800' },
  'Master Data': { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', header: 'text-purple-800' },
  'Danger Zone': { bg: 'bg-slate-50',  border: 'border-slate-300',  badge: 'bg-slate-800 text-white',     header: 'text-slate-900' },
};

export function NotificationAdminPanel() {
  const prefs = useSyncStore(state => state.globalNotificationPrefs);
  const [isSaving, setIsSaving] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  
  const getAudience = (key: string): 'all' | 'admin' | 'none' => {
    if (key in prefs) {
      const val = prefs[key] as any;
      if (val === true) return 'all';
      if (val === false) return 'none';
      return val;
    }
    const def = NOTIFICATION_EVENTS.find(e => e.key === key);
    return def ? def.defaultAudience : 'none';
  };

  const setAudience = async (key: string, val: 'all' | 'admin' | 'none') => {
    setIsSaving(true);
    try {
      const newPrefs = { ...prefs, [key]: val };
      useSyncStore.getState().setGlobalNotificationPrefs(newPrefs);
      await cloudSaveSettingNow('global_notification_preferences', newPrefs);
    } finally {
      setIsSaving(false);
    }
  };

  const setAll = async (val: 'all' | 'admin' | 'none') => {
    setIsSaving(true);
    try {
      const newPrefs: Record<string, 'all' | 'admin' | 'none'> = {};
      NOTIFICATION_EVENTS.forEach(e => { newPrefs[e.key] = val; });
      useSyncStore.getState().setGlobalNotificationPrefs(newPrefs);
      await cloudSaveSettingNow('global_notification_preferences', newPrefs);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const activeCount = NOTIFICATION_EVENTS.filter(e => getAudience(e.key) !== 'none').length;

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="bg-white rounded-2xl p-4 border border-teal-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-teal-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Global Push Notification Triggers</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Super Admin only · {activeCount}/{NOTIFICATION_EVENTS.length} events active · Syncs live across all clients
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              disabled={isSaving}
              onClick={() => setAll('none')}
              className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition disabled:opacity-50"
            >
              All Disabled
            </button>
            <button
              disabled={isSaving}
              onClick={() => setAll('admin')}
              className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition disabled:opacity-50"
            >
              All Admins
            </button>
            <button
              disabled={isSaving}
              onClick={() => setAll('all')}
              className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition disabled:opacity-50"
            >
              All Users
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${(activeCount / NOTIFICATION_EVENTS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const events = NOTIFICATION_EVENTS.filter(e => e.category === cat);
        const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Daybook'];
        const isCollapsed = collapsed[cat];
        const catActiveCount = events.filter(e => getAudience(e.key) !== 'none').length;

        return (
          <div key={cat} className={`rounded-xl border ${colors.border} overflow-hidden shadow-sm`}>
            {/* Category header */}
            <button
              className={`w-full flex items-center justify-between p-3 ${colors.bg} transition-colors hover:brightness-95`}
              onClick={() => toggleCategory(cat)}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>{cat}</span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {catActiveCount}/{events.length} active
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>

            {/* Events list */}
            {!isCollapsed && (
              <div className="divide-y divide-slate-100 bg-white">
                {events.map(event => (
                  <div key={event.key} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-3">
                      <span className={`mt-0.5 shrink-0 ${getAudience(event.key) !== 'none' ? 'text-teal-600' : 'text-slate-300'} transition-colors`}>
                        {event.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800">{event.label}</span>
                          {event.warning && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                              ⚠ {event.warning}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{event.description}</p>
                      </div>
                    </div>

                    {/* Target Selector */}
                    <select
                      disabled={isSaving}
                      value={getAudience(event.key)}
                      onChange={(e) => setAudience(event.key, e.target.value as 'all' | 'admin' | 'none')}
                      className={`text-xs rounded-lg px-2 py-1.5 font-medium border focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer disabled:opacity-50 ${
                        getAudience(event.key) === 'all' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                        getAudience(event.key) === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      <option value="none">Disabled</option>
                      <option value="admin">Admins Only</option>
                      <option value="all">All Users</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Export the event catalogue so triggerEventNotification callers can reference keys
export { NOTIFICATION_EVENTS };
export type { NotifEventDef };
