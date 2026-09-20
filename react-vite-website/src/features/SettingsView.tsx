import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSyncStore } from '../store/useSyncStore';

import { cloudDeleteDateReport } from '../lib/syncEngine';
import { triggerEventNotification } from '../lib/syncEngine';
import { logout, updateProfileRole, toggleProfileStatus, createNewUser } from '../lib/auth';
import { requestFCMToken } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { getRecentErrors } from '../lib/logger';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LogOut, Plus, Trash2, Edit2, Users, ShieldAlert, PowerOff, Flame, Skull, RefreshCw, Store, Truck, FileText, Eraser, AlertTriangle, ArrowUp, ArrowDown, Settings2, X, CheckSquare, Square, Loader2, BarChart2, Bell, Send, Filter, ChevronRight, PackageX } from 'lucide-react';
import { DisplaySettingsTab } from '../components/DisplaySettingsTab';
import { confirmPrompt } from '../store/useConfirmStore';
import { AnalyticsView } from './AnalyticsView';
import { NotificationAdminPanel } from './NotificationAdminPanel';
import { toast } from 'sonner';

export const SettingsView: React.FC = () => {
  const confirmAction = async (title: string, description: string, onConfirm: () => void, isDestructive = true) => {
    const proceed = await confirmPrompt({ title, description, isDestructive });
    if (proceed) {
      onConfirm();
    }
  };

  const { 
    configuredGodowns, dailyReports, setConfiguredGodowns, reorderGodown,
    mainGodowns, toggleMainGodown,
    suppliers, addSupplier, renameSupplier, removeSupplier, clearSuppliers,
    clearProductMaster, userPermissions, setUserPermissions, activityLogs, logActivity,
    userAvatars, setUserAvatar, renameGodown, removeGodown, configuredUsers
  } = useAppStore();
  const { user } = useAuthStore();
  
  // Helper to check granular permissions
  const hasPerm = (perm: string) => {
    if (user?.role === 'admin') return true;
    if (!user) return false;
    const perms = userPermissions[user.uid] || ['/', '/zero-stock'];
    return perms.includes(perm);
  };
  
  const [newGodown, setNewGodown] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'advanced' | 'danger' | 'activity' | 'insights' | 'display' | 'notifications'>(user?.role === 'admin' ? 'general' : 'display');

  const [permissionsUser, setPermissionsUser] = useState<any>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // add user states
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'worker'>('worker');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  React.useEffect(() => {
    if (!addUserModalOpen) {
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('worker');
      setIsCheckingEmail(false);
      return;
    }
    
    if (!newUserName) {
      setNewUserEmail('');
      return;
    }

    const baseStr = newUserName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!baseStr) {
      setNewUserEmail('');
      return;
    }

    const checkAvailability = async () => {
      setIsCheckingEmail(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .ilike('email', `${baseStr}%@mansurenterprises.com`);
          
        if (error || !data) {
          setNewUserEmail(`${baseStr}@mansurenterprises.com`);
          return;
        }
        
        const existingEmails = data.map((d: any) => d.email);
        
        if (!existingEmails.includes(`${baseStr}@mansurenterprises.com`)) {
          setNewUserEmail(`${baseStr}@mansurenterprises.com`);
          return;
        }
        
        let counter = 1;
        while (existingEmails.includes(`${baseStr}${counter}@mansurenterprises.com`)) {
          counter++;
        }
        setNewUserEmail(`${baseStr}${counter}@mansurenterprises.com`);
        
      } catch (e) {
        setNewUserEmail(`${baseStr}@mansurenterprises.com`);
      } finally {
        setIsCheckingEmail(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 400);
    return () => clearTimeout(timeoutId);
  }, [newUserName, addUserModalOpen]);

  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [selectedGodownsToWipe, setSelectedGodownsToWipe] = useState<string[]>([]);
  const [selectedSuppliersToWipe, setSelectedSuppliersToWipe] = useState<string[]>([]);
  const [selectedDatesToWipe, setSelectedDatesToWipe] = useState<string[]>([]);
  const [wipeProductMaster, setWipeProductMaster] = useState(false);
  const [suspendOtherUsers, setSuspendOtherUsers] = useState(false);

  React.useEffect(() => {
    if (!wipeModalOpen) {
      setSelectedGodownsToWipe([]);
      setSelectedSuppliersToWipe([]);
      setSelectedDatesToWipe([]);
      setWipeProductMaster(false);
      setSuspendOtherUsers(false);
    }
  }, [wipeModalOpen]);

  const [testNotificationStatus, setTestNotificationStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [fcmPermission, setFcmPermission] = useState<string>('default');

  React.useEffect(() => {
    const checkPerms = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const status = await PushNotifications.checkPermissions();
          setFcmPermission(status.receive); // 'prompt', 'prompt-with-rationale', 'granted', 'denied'
        } catch (e) {
          console.error('Error checking native push permissions:', e);
        }
      } else if ('Notification' in window) {
        setFcmPermission(Notification.permission);
      }
    };
    checkPerms();
  }, []);

  const handleRequestPermission = async () => {
    setFcmPermission('requesting');
    try {
      if (Capacitor.isNativePlatform()) {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          throw new Error('Permission denied by user.');
        }
        await PushNotifications.register();
        // The listener in usePushNotifications will handle saving to DB
        setFcmPermission('granted');
        toast.success('Native Push Notifications enabled!');
      } else {
        const token = await requestFCMToken();
        if (token && user?.uid) {
           await supabase
            .from('profiles')
            .update({ fcm_token: token })
            .eq('id', user.uid);
        }
        
        if (Notification.permission === 'granted') {
          setFcmPermission('granted');
          toast.success('Push Notifications enabled!');
        } else {
          setFcmPermission('denied');
          toast.error('Notification permission was denied.');
        }
      }
    } catch (err) {
      console.error('Failed to request notification permission:', err);
      setFcmPermission('denied');
      toast.error('Failed to enable notifications.');
    }
  };

    const handleSendTestNotification = async () => {
    setTestNotificationStatus('sending');
    try {
      let targetToken: string;

      if (Capacitor.isNativePlatform()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('fcm_token')
          .eq('id', user?.uid || '')
          .single();
        targetToken = profile?.fcm_token || 'simulated_admin_token';
      } else {
        const token = await requestFCMToken();
        targetToken = token || 'simulated_admin_token';
      }
      
      const timestamp = new Date().toLocaleTimeString();
      const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { error } = await supabase.functions.invoke('send_fcm', {
        body: { 
          token: targetToken, 
          title: `System Test [${randomStr}]`, 
          body: `Test notification sent at ${timestamp}. Your FCM push pipeline is successfully connected and responding.` 
        }
      });
      
      if (error) throw error;
      
      setTestNotificationStatus('success');
      toast.success('Test notification sent immediately!');
      setTimeout(() => setTestNotificationStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Test notification failed:', err);
      setTestNotificationStatus('error');
      setTimeout(() => setTestNotificationStatus('idle'), 4000);
    }
  };

  const [editingGodownIndex, setEditingGodownIndex] = useState<number | null>(null);
  const [editingGodownName, setEditingGodownName] = useState('');
  const [editingGodownIsMain, setEditingGodownIsMain] = useState(false);

  const [editingSupplierOldName, setEditingSupplierOldName] = useState<string | null>(null);
  const [editingSupplierNewName, setEditingSupplierNewName] = useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user?.uid) {
      // Compress/resize avatar slightly before storing (using canvas)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 150;
          const MAX_HEIGHT = 150;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          setUserAvatar(user.uid, compressed);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  React.useEffect(() => {
    // configuredUsers is now automatically kept strictly in sync via syncEngine
  }, [user?.role]);

  const handleAddGodown = () => {
    if (user?.role !== 'admin' && user?.role !== 'worker') {
      alert('Permission denied. Ask an admin.');
      return;
    }
    const val = newGodown.trim();
    if (val && !configuredGodowns.includes(val)) {
      setConfiguredGodowns([...configuredGodowns, val]);
      setNewGodown('');
      triggerEventNotification('godown_added', { title: 'Godown Added', body: `New godown "${val}" has been added.` }).catch(() => {});
    }
  };

  const handleRenameGodown = (index: number) => {
    if (!hasPerm('action:manage_godowns')) {
      alert('Permission denied. Ask an admin.');
      return;
    }
    const oldName = configuredGodowns[index];
    setEditingGodownIndex(index);
    setEditingGodownName(oldName);
    setEditingGodownIsMain(mainGodowns?.includes(oldName) || false);
  };
  
  const handleSaveGodownEdit = () => {
    if (editingGodownIndex === null) return;
    const oldName = configuredGodowns[editingGodownIndex];
    const finalName = editingGodownName.trim();
    
    if (!finalName) {
      setEditingGodownIndex(null);
      return;
    }
    
    if (finalName !== oldName && configuredGodowns.includes(finalName)) {
      alert(`"${finalName}" already exists.`);
      return;
    }

    if (finalName !== oldName) {
      renameGodown(oldName, finalName);
    }

    const wasMain = mainGodowns?.includes(finalName) || false;
    if (editingGodownIsMain && !wasMain) {
      toggleMainGodown(finalName);
    } else if (!editingGodownIsMain && wasMain) {
      toggleMainGodown(finalName);
    }
    
    setEditingGodownIndex(null);
  };

  const handleRemoveGodown = (idx: number) => {
    if (!hasPerm('action:manage_godowns')) {
      alert('Permission denied: Ask an admin.');
      return;
    }
    if (configuredGodowns.length <= 1) {
      alert('You must have at least one godown configured.');
      return;
    }
    const oldName = configuredGodowns[idx];
    confirmAction('Remove Godown', `Remove godown "${oldName}"?`, () => {
      removeGodown(oldName);
      logActivity('Remove Godown', `Removed godown: ${oldName}`);
      triggerEventNotification('godown_removed', { title: 'Godown Removed', body: `"${oldName}" was removed from the system.` }).catch(() => {});
    });
  };

  const handleAddSupplier = () => {
    if (!newSupplier.trim()) return;
    if (!hasPerm('action:manage_suppliers')) {
      alert('Permission denied: Ask an admin.');
      return;
    }
    const val = newSupplier.trim();
    if (val && !suppliers.includes(val)) {
      addSupplier(val);
      setNewSupplier('');
      logActivity('Add Supplier', `Added new supplier: ${val}`);
      triggerEventNotification('supplier_added', { title: 'Supplier Added', body: `New supplier "${val}" was added.` }).catch(() => {});
    }
  };

  const handleRenameSupplier = (oldName: string) => {
    if (!hasPerm('action:manage_suppliers')) {
      alert('Permission denied: Ask an admin.');
      return;
    }
    setEditingSupplierOldName(oldName);
    setEditingSupplierNewName(oldName);
  };

  const handleSaveSupplierEdit = () => {
    if (!editingSupplierOldName) return;
    const finalName = editingSupplierNewName.trim();
    if (!finalName) {
      setEditingSupplierOldName(null);
      return;
    }
    
    if (finalName !== editingSupplierOldName && suppliers.includes(finalName)) {
      alert(`"${finalName}" already exists.`);
      return;
    }

    if (finalName !== editingSupplierOldName) {
      renameSupplier(editingSupplierOldName, finalName);
      logActivity('Rename Supplier', `Renamed supplier ${editingSupplierOldName} to ${finalName}`);
    }
    setEditingSupplierOldName(null);
  };

  const handleRemoveSupplier = (name: string) => {
    if (!hasPerm('action:manage_suppliers')) {
      alert('Permission denied: Ask an admin.');
      return;
    }
    confirmAction('Remove Supplier', `Remove supplier "${name}"?`, () => {
      removeSupplier(name);
      logActivity('Delete Supplier', `Deleted supplier: ${name}`);
      triggerEventNotification('supplier_removed', { title: 'Supplier Removed', body: `Supplier "${name}" was removed from the system.` }).catch(() => {});
    });
  };

  const handleClearProductMaster = () => {
    if (!hasPerm('action:manage_data_product_master')) return;
    confirmAction('Clear Product Master', 'Clear Product Master Cache?\nThe system will forget all assigned godowns and will re-learn them from the next PDF.', () => {
      clearProductMaster();
      logActivity('Clear Product Master', 'Cleared the entire product godown/supplier cache.');
      triggerEventNotification('product_master_cleared', { title: 'Product Cache Cleared', body: 'The product godown/supplier cache has been wiped.' }).catch(() => {});
    });
  };

  const dates = Object.keys(dailyReports).sort((a, b) => {
    const dA = a.split('/').reverse().join('');
    const dB = b.split('/').reverse().join('');
    return dB.localeCompare(dA);
  });
  const totalExtracted = dates.reduce((sum, d) => sum + (dailyReports[d]?.extracted?.length || 0), 0);
  const totalRefills = dates.reduce((sum, d) => sum + (dailyReports[d]?.final?.length || 0), 0);

  const handleDeleteSheet = async (dateStr: string) => {
    if (!hasPerm('action:daybook_delete')) {
      alert('Permission denied: Ask an admin.');
      return;
    }
    confirmAction('Delete Sheet', `Delete sheet ${dateStr} for ALL users?\nCannot undo.`, async () => {
      const result = await cloudDeleteDateReport(dateStr);
      if (!result.success) {
        alert(`Failed to delete sheet: ${result.error}`);
        return;
      }
      const newReports = { ...dailyReports };
      delete newReports[dateStr];
      useAppStore.setState({ dailyReports: newReports });
      logActivity('Delete Single Sheet', `Deleted daybook sheet for date: ${dateStr}`);
    });
  };

  const handleDeleteAllSheets = async () => {
    if (!hasPerm('action:daybook_delete_all')) {
      alert('Permission denied: Ask an admin.');
      return;
    }
    confirmAction('Delete ALL Sheets', 'Delete EVERY sheet for ALL users?\nReally wipe the full shared daybook?\nLast chance cannot undo.', async () => {
      let failed = 0;
      for (const dateStr of dates) {
        const res = await cloudDeleteDateReport(dateStr);
        if (!res.success) failed++;
      }
      useAppStore.setState({ dailyReports: {} });
      if (failed > 0) alert(`Wiped sheets, but ${failed} failed to delete from cloud.`);
      else alert('Daybook completely wiped.');
      logActivity('Delete All Sheets', 'Wiped ALL daybook sheets.');
      triggerEventNotification('report_all_deleted', { title: '⚠ All Reports Deleted', body: `All ${dates.length} daybook sheets have been wiped.` }).catch(() => {});
    });
  };

  const handleToggleUserStatus = async (targetId: string, currentDisabled: boolean) => {
    if (targetId === user?.uid) {
      alert("You cannot disable yourself.");
      return;
    }
    const action = currentDisabled ? 'Enable' : 'Disable';
    confirmAction(`${action} User`, `${action} this user?`, async () => {
      const ok = await toggleProfileStatus(targetId, !currentDisabled);
      if (ok) {
        const statusLabel = !currentDisabled ? 'Suspended' : 'Enabled';
        logActivity('Change Status', `${statusLabel} user ${targetId}`);
        triggerEventNotification('user_suspended', {
          title: `User ${statusLabel}`,
          body: `User account has been ${statusLabel.toLowerCase()} by an admin.`
        }).catch(() => {});
      }
    });
  };

  const handleUpdateUserRole = async (targetId: string, currentRole: string) => {
    if (targetId === user?.uid) {
      alert("You cannot change your own role.");
      return;
    }
    const newRole = currentRole === 'admin' ? 'worker' : 'admin';
    confirmAction('Change Role', `Change role to ${newRole.toUpperCase()}?`, async () => {
      const ok = await updateProfileRole(targetId, newRole);
      if (ok) {
        logActivity('Change Role', `Changed role of user ${targetId} to ${newRole}`);
        triggerEventNotification('user_role_changed', {
          title: 'User Role Changed',
          body: `A user's role has been changed to ${newRole}.`
        }).catch(() => {});
      }
    });
  };



  const handleToggleUserPermission = (uid: string, perm: string) => {
    const current = userPermissions[uid] || ['/', '/zero-stock'];
    const next = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
    setUserPermissions(uid, next);
    logActivity('Change Permissions', `Toggled permission ${perm} for user ID ${uid}`);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) {
      alert('Please fill in all fields');
      return;
    }
    if (newUserPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }
    setIsCreatingUser(true);
    const res = await createNewUser(newUserEmail, newUserPassword, newUserName, newUserRole);
    setIsCreatingUser(false);
    
    if (res.success) {
      alert('Account created successfully!');
      setAddUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('worker');
      logActivity('Create User', `Created ${newUserRole} account for ${newUserName}`);
      // Note: user_created fires in auth.ts when first login occurs
    } else {
      alert(`Error creating user: ${res.error}`);
    }
  };

  const PERMISSIONS_LIST = [
    // ── Page Access ───────────────────────────────────────────────────────────
    { path: '/', label: 'Daybook View', desc: 'Access the main daybook worksheet' },
    { path: '/zero-stock', label: '0 Stock View', desc: 'Access the zero stock / refill panel' },
    { path: '/upload', label: 'Upload View', desc: 'Access the PDF upload & parse page' },
    { path: '/reports', label: 'Reports View', desc: 'Access the reports & history page' },
    { path: '/settings', label: 'Settings View', desc: 'Access the settings page' },

    // ── Daybook Actions ───────────────────────────────────────────────────────
    { path: 'action:upload_parse', label: 'Upload & Parse PDFs', desc: 'Upload and parse stock PDFs into the daybook' },
    { path: 'action:daybook_delete', label: 'Delete Single Sheets', desc: 'Delete a specific daybook sheet' },
    { path: 'action:daybook_delete_all', label: 'Delete All Sheets', desc: 'Wipe all daybook sheets at once' },
    { path: 'action:daybook_undo_others', label: "Undo Others' Actions", desc: 'Undo or override items saved by other users' },
    { path: 'action:daybook_reset', label: 'Reset Full Sheet', desc: 'Reset all items in a daybook back to unsaved state' },
    { path: 'action:daybook_export', label: 'Export / Print Reports', desc: 'Export daybook sheets to PDF or print' },

    // ── Zero Stock / Inventory ────────────────────────────────────────────────
    { path: 'action:refill_mark', label: 'Mark Items as Ordered', desc: 'Mark zero stock items as ordered from a supplier' },
    { path: 'action:refill_clear', label: 'Clear Refill Status', desc: 'Remove the ordered/refilled status from an item' },

    // ── Master Data Management ────────────────────────────────────────────────
    { path: 'action:manage_godowns', label: 'Manage Godowns', desc: 'Add, rename or remove godown / store locations' },
    { path: 'action:manage_suppliers', label: 'Manage Suppliers', desc: 'Add, rename or remove supplier names' },
    { path: 'action:manage_data_product_master', label: 'Clear Product Cache', desc: 'Wipe the product godown/supplier assignment cache' },
    { path: 'action:manage_aliases', label: 'Manage Godown Aliases', desc: 'Edit name aliases for godown locations' },

    // ── User & Access Management ──────────────────────────────────────────────
    { path: 'action:manage_users_view', label: 'View User Directory', desc: 'View the list of all registered users' },
    { path: 'action:manage_users_status', label: 'Suspend / Enable Users', desc: 'Toggle active/suspended status for other users' },
    { path: 'action:manage_users_role', label: 'Change User Roles', desc: 'Promote or demote users between worker and admin' },
    { path: 'action:manage_users_permissions', label: 'Edit User Permissions', desc: 'Modify per-user page & action access rights' },
    { path: 'action:manage_users_create', label: 'Create New Accounts', desc: 'Create new user accounts in the system' },
  ];

  const handleMasterWipe = async () => {
    confirmAction('Master Wipe', '🚨 WARNING 🚨\nYou are about to execute a MASTER WIPE.\n\nThis will delete:\n- All Daybook Sheets\n- All Product Memory\n- All Godowns\n- All Aliases\n- All Suppliers\n\nAre you ABSOLUTELY SURE? There is no undo!', async () => {
    
    let failed = 0;
    for (const d of dates) {
      const res = await cloudDeleteDateReport(d);
      if (!res.success) failed++;
    }
    useAppStore.setState({ dailyReports: {} });
    
    clearProductMaster();
    setConfiguredGodowns(['Main Store']);
    const { setMainGodowns } = useAppStore.getState();
    setMainGodowns(['Main Store']);
    clearSuppliers();
    
    if (failed > 0) {
      alert(`Master Wipe Complete, but ${failed} sheets failed to delete from cloud.`);
    } else {
      alert('Master Wipe Complete. System is now fresh.');
    }
    logActivity('Master Wipe', 'Executed a full system master wipe (All Data, Godowns, Suppliers, Sheets).');
    triggerEventNotification('master_wipe', {
      title: '🚨 MASTER WIPE EXECUTED',
      body: 'A full system wipe was performed. All reports, godowns, suppliers, and product cache have been cleared.'
    }).catch(() => {});
    });
  };

  const isSuperAdmin = user?.email?.toLowerCase() === 'bhavesh@mansurenterprises.com';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;

  return (
    <div className="flex-1 w-full bg-slate-50 flex flex-col relative pb-6">
      <header className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md px-4 pt-3 pb-2.5 border-b border-slate-200/70 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Settings</h1>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Enterprise ERP Suite</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white text-slate-700 border border-slate-200/80 shadow-xs">
            Mansur Enterprises
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 pt-3.5 space-y-3.5 md:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        {/* Account Card */}
        <section className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div 
              className="relative shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-bold text-xl ring-2 ring-blue-50/50 shadow-inner border border-slate-200 uppercase cursor-pointer transition-transform hover:scale-105 active:scale-95"
              onClick={() => fileInputRef.current?.click()}
              title="Click to upload profile picture"
            >
              {userAvatars[user?.uid || ''] ? (
                <img src={userAvatars[user?.uid || '']} alt="Avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                user?.name?.charAt(0) || 'U'
              )}
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 truncate tracking-tight">{user?.name}</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider ${isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {isAdmin ? 'ADMIN' : 'STAFF'}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5 font-normal">{user?.email}</p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              const { pendingSync, saveInFlight } = useSyncStore.getState();
              const hasPending = Object.keys(pendingSync).length > 0 || saveInFlight > 0;
              
              const msg = hasPending 
                ? '🚨 WARNING: You have unsynced offline changes!\n\nLogging out now will PERMANENTLY DELETE your offline work.\n\nAre you ABSOLUTELY sure you want to sign out?'
                : 'Are you sure you want to sign out?';
                
              confirmAction('Sign Out', msg, async () => {
                setIsLoggingOut(true);
                try {
                  await logout();
                } catch (e) {
                  setIsLoggingOut(false);
                }
              });
            }}
            disabled={isLoggingOut}
            className="shrink-0 ml-2 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50/70 hover:bg-rose-100 active:scale-95 border border-rose-200/70 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
            title="Sign out of account"
          >
            {isLoggingOut ? (
              <svg className="animate-spin w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <LogOut size={14} className="stroke-[2.2]" />
            )}
            <span>{isLoggingOut ? 'Exiting...' : 'Exit'}</span>
          </button>
        </section>

        {isLoggingOut && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[999] flex flex-col items-center justify-center animate-in fade-in duration-200">
            <svg className="animate-spin w-8 h-8 text-rose-600 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm font-bold text-slate-800">Signing out safely...</p>
            <p className="text-xs font-medium text-slate-500">Securing your session</p>
          </div>
        )}

        {/* Tabs and Content Wrapper for Desktop */}
        <div className="md:grid md:grid-cols-[200px_1fr] lg:grid-cols-[250px_1fr] md:gap-6 lg:gap-8 flex flex-col space-y-3.5 md:space-y-0 pb-12">
          <div className="shrink-0">
            {/* Tabs */}
            <nav className="flex md:flex-col overflow-x-auto hide-scrollbar whitespace-nowrap bg-slate-200/70 md:bg-transparent p-1 md:p-0 rounded-xl gap-1 md:gap-2 text-xs font-medium items-center md:items-stretch snap-x scroll-px-1">
              <button 
                onClick={() => setActiveTab('display')}
                className={`shrink-0 py-1.5 md:py-2.5 px-3 md:justify-start flex items-center justify-center gap-2 rounded-lg transition font-medium text-[11px] md:text-sm snap-start ${activeTab === 'display' ? 'bg-white md:bg-blue-50 text-blue-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Settings2 size={16} className={activeTab === 'display' ? 'text-blue-600' : 'text-slate-400'} />
                <span>Display</span>
              </button>
              
              {isAdmin && (
                <>
                  <button 
                    onClick={() => setActiveTab('general')}
                    className={`shrink-0 py-1.5 md:py-2.5 px-3 md:text-left rounded-lg transition font-medium text-[11px] md:text-sm snap-start ${activeTab === 'general' ? 'bg-white md:bg-blue-50 text-blue-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    General
                  </button>
                  <button 
                    onClick={() => setActiveTab('advanced')}
                    className={`shrink-0 py-1.5 md:py-2.5 px-3 md:text-left rounded-lg transition font-medium text-[11px] md:text-sm snap-start ${activeTab === 'advanced' ? 'bg-white md:bg-blue-50 text-blue-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    Advanced
                  </button>
                  <button 
                    onClick={() => setActiveTab('insights')}
                    className={`shrink-0 py-1.5 md:py-2.5 px-3 md:justify-start flex items-center justify-center gap-2 rounded-lg transition font-medium text-[11px] md:text-sm snap-start ${activeTab === 'insights' ? 'bg-white md:bg-purple-50 text-purple-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-purple-600'}`}
                  >
                    <BarChart2 size={16} className={activeTab === 'insights' ? 'text-purple-600' : 'text-purple-400'} />
                    <span>Analytics</span>
                  </button>
                  {isSuperAdmin ? (
                    <>
                      <button 
                        onClick={() => setActiveTab('notifications')}
                        className={`shrink-0 py-1.5 md:py-2.5 px-3 md:justify-start flex items-center justify-center gap-2 rounded-lg transition font-medium text-[11px] md:text-sm snap-start ${activeTab === 'notifications' ? 'bg-white md:bg-teal-50 text-teal-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-teal-600'}`}
                      >
                        <Bell size={16} className={activeTab === 'notifications' ? 'text-teal-600' : 'text-slate-400'} />
                        <span>Alerts</span>
                      </button>
                      <button 
                        onClick={() => setActiveTab('danger')}
                        className={`shrink-0 py-1.5 md:py-2.5 px-3 md:justify-start flex items-center justify-center gap-2 rounded-lg transition font-medium text-[11px] md:text-sm snap-start ${activeTab === 'danger' ? 'bg-white md:bg-rose-50 text-rose-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-rose-600'}`}
                      >
                        <Flame size={16} className={activeTab === 'danger' ? 'text-rose-600' : 'text-amber-500'} />
                        <span>Danger</span>
                      </button>
                      <button 
                        onClick={() => setActiveTab('activity')}
                        className={`shrink-0 py-1.5 md:py-2.5 px-3 md:text-left rounded-lg transition font-medium text-[11px] md:text-sm snap-start ${activeTab === 'activity' ? 'bg-white md:bg-indigo-50 text-indigo-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                      >
                        Activity
                      </button>
                    </>
                  ) : (
                    <div className="shrink-0 py-1.5 md:py-2.5 px-3 md:text-left rounded-lg transition font-medium text-[11px] md:text-sm text-slate-400 flex items-center justify-center cursor-not-allowed">
                      Danger
                    </div>
                  )}
                </>
              )}
            </nav>
          </div>
          
          <div className="space-y-3.5 min-w-0">

        {activeTab === 'display' && (
          <DisplaySettingsTab />
        )}

        {isAdmin && activeTab === 'general' && (
          <>
            {/* System Status & Storage Strip */}
            <section className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-card space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <RefreshCw size={18} className="text-blue-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">Cloud Synchronization</span>
                    <span className="text-[11px] text-slate-400 leading-tight">Real-time sync active & backed up</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active / Synced
                </span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">STORAGE & ASSETS</span>
                  <span className="text-[10px] text-slate-400 font-medium">Auto-calculated</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl py-2 px-2 text-center">
                    <span className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Sheets</span>
                    <span className="block text-lg font-bold text-slate-900 mt-0.5">{dates.length}</span>
                  </div>
                  <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl py-2 px-2 text-center">
                    <span className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Products</span>
                    <span className="block text-lg font-bold text-slate-900 mt-0.5">{totalExtracted.toLocaleString()}</span>
                  </div>
                  <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl py-2 px-2 text-center">
                    <span className="block text-[10px] font-semibold tracking-wider text-amber-700 uppercase">Refills</span>
                    <span className="block text-lg font-bold text-amber-600 mt-0.5">{totalRefills.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Godowns */}
            <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Store size={19} className="text-blue-600" />
                  <span className="text-xs font-bold tracking-tight text-slate-900 uppercase">Warehouse Godowns</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">{configuredGodowns.length} Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text"
                    value={newGodown}
                    onChange={e => setNewGodown(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddGodown(); }}
                    className="w-full text-xs font-normal rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-3.5 pr-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 focus:bg-white transition-all shadow-xs" 
                    placeholder="Add new godown name..." 
                  />
                </div>
                <button 
                  onClick={handleAddGodown}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1 shrink-0"
                >
                  <Plus size={15} />
                  <span>Add</span>
                </button>
              </div>
              <div className="space-y-1.5 pt-1">
                {configuredGodowns.length === 0 && (
                  <div className="text-[10px] text-center text-slate-400 font-semibold py-2">No godowns configured.</div>
                )}
                {configuredGodowns.map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 hover:bg-slate-50 border border-slate-200/60 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Store size={18} className="text-slate-400 shrink-0" />
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-900 truncate">{idx + 1}. {g}</span>
                        {mainGodowns?.includes(g) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-200/50 shrink-0">Main HQ</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button onClick={() => toggleMainGodown(g)} className={`p-1.5 rounded-lg transition-colors ${mainGodowns?.includes(g) ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`} title="Toggle Main HQ">
                        <ShieldAlert size={16} />
                      </button>
                      {idx > 0 && (
                        <button onClick={() => reorderGodown(idx, idx - 1)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors" title="Move Up">
                          <ArrowUp size={16} />
                        </button>
                      )}
                      {idx < configuredGodowns.length - 1 && (
                        <button onClick={() => reorderGodown(idx, idx + 1)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors" title="Move Down">
                          <ArrowDown size={16} />
                        </button>
                      )}
                      <button onClick={() => handleRenameGodown(idx)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors" title="Edit Godown">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleRemoveGodown(idx)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors" title="Delete Godown">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {isAdmin && activeTab === 'advanced' && (
          <>
            {/* User Directory */}
            <section className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-card space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users size={14} />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">User Directory</h2>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">{configuredUsers.length}</span>
                </div>
                <button onClick={() => setAddUserModalOpen(true)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 px-2 py-0.5 rounded-md transition-all flex items-center gap-0.5" type="button">
                  <Plus size={12} strokeWidth={2.5} />
                  <span>Add Account</span>
                </button>
              </div>
              <div className="space-y-1.5">
                {configuredUsers.length === 0 ? (
                  <div className="text-[10px] text-center text-slate-400 font-semibold py-2">Loading...</div>
                ) : (
                  configuredUsers
                    .filter(u => u.email.toLowerCase() !== 'bhavesh@mansurenterprises.com')
                    .map((u) => (
                      <div key={u.id} className="p-2 rounded-lg bg-slate-50/80 hover:bg-slate-50 border border-slate-200/60 flex items-center justify-between transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center shrink-0 uppercase overflow-hidden ${u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                            {userAvatars[u.id] ? (
                              <img src={userAvatars[u.id]} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              u.name.charAt(0)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-800 truncate">{u.name}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold border ${u.role === 'admin' ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {u.role === 'admin' ? 'ADMIN' : 'STAFF'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 text-slate-400 shrink-0">
                          {u.role === 'worker' && (
                            <button onClick={() => setPermissionsUser(u)} className="p-1 hover:text-blue-600 rounded transition" title="Tune Roles">
                              <Settings2 size={14} />
                            </button>
                          )}
                          <button onClick={() => handleUpdateUserRole(u.id, u.role)} className="p-1 hover:text-slate-700 rounded transition" title="Security Status">
                            <ShieldAlert size={14} />
                          </button>
                          <button onClick={() => handleToggleUserStatus(u.id, u.is_disabled)} className="p-1 hover:text-rose-500 rounded transition" title="Disable User">
                            <PowerOff size={14} className={u.is_disabled ? 'text-emerald-500' : ''} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </section>

            {/* Suppliers */}
            <section className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-card space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Truck size={14} />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Suppliers</h2>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">{suppliers.length} Active</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">Manage vendors</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text"
                    value={newSupplier}
                    onChange={e => setNewSupplier(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSupplier(); }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-3 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 text-slate-800 placeholder-slate-400 transition" 
                    placeholder="New supplier name..." 
                  />
                </div>
                <button 
                  onClick={handleAddSupplier}
                  className="shrink-0 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-medium text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Add</span>
                </button>
              </div>
              <div className="space-y-1.5 pt-1">
                {suppliers.length === 0 && (
                  <div className="text-[10px] text-center text-slate-400 font-semibold py-2">No suppliers found.</div>
                )}
                {suppliers.map((s, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-50/80 hover:bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-100 uppercase">
                        {s.charAt(0)}
                      </span>
                      <span className="text-xs font-medium text-slate-800">{s}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleRenameSupplier(s)} className="p-1 text-slate-400 hover:text-slate-600 rounded transition" title="Rename">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleRemoveSupplier(s)} className="p-1 text-slate-400 hover:text-rose-500 rounded transition" title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>



            {/* Data Management */}
            <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card space-y-3">
              <div className="flex items-center gap-1.5 text-slate-700 mb-1">
                <FileText size={19} className="text-blue-600" />
                <span className="text-xs font-bold tracking-tight text-slate-900 uppercase">Data Management</span>
              </div>
              <div className="space-y-1.5">
                {dates.length === 0 && (
                  <div className="text-[10px] text-center text-slate-400 font-semibold py-2">No reports saved yet.</div>
                )}
                {dates.map(dateStr => {
                  const rep = dailyReports[dateStr];
                  const extracted = rep?.extracted?.length || 0;
                  const refs = rep?.final?.length || 0;
                  return (
                    <div key={dateStr} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 border border-slate-200/60 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{dateStr}</div>
                        <div className="text-[10px] font-medium text-slate-500 mt-0.5 truncate">{extracted} products  {refs} tasks</div>
                      </div>
                      <button onClick={() => handleDeleteSheet(dateStr)} className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 ml-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-dashed border-slate-200 space-y-2">
                <button 
                  onClick={handleClearProductMaster}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 hover:bg-amber-100 active:scale-95 rounded-xl transition-all"
                >
                  <Eraser size={14} /> Wipe Product Master Cache
                </button>
                {dates.length > 0 && (
                  <button 
                    onClick={handleDeleteAllSheets}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 active:scale-95 rounded-xl transition-all"
                  >
                    <AlertTriangle size={14} /> Wipe All Daybook Sheets
                  </button>
                )}
              </div>
            </section>
          </>
        )}

        {isAdmin && activeTab === 'insights' && (
          <div className="-mx-2 md:mx-0">
            <AnalyticsView />
          </div>
        )}

        {isSuperAdmin && activeTab === 'danger' && (
          <section className="bg-white rounded-[20px] p-5 border border-rose-200 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-rose-50/50 to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 border-b border-rose-100 pb-3 z-10 relative">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                <Flame size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-rose-600">Danger Zone</h3>
                <p className="text-[10px] uppercase tracking-widest text-rose-400 font-semibold mt-0.5">Irreversible Actions</p>
              </div>
            </div>
            
            <div className="z-10 relative space-y-3">
              <div className="bg-rose-50/50 rounded-xl p-3 border border-rose-100 flex items-start gap-3">
                <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 font-medium leading-relaxed">
                  Proceed with extreme caution. Data wiped from here is permanently deleted from the cloud database and cannot be recovered without a deep backup restore.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setWipeModalOpen(true)}
                  className="w-full group relative overflow-hidden flex items-center justify-between p-3.5 bg-white border border-slate-200 hover:border-rose-300 rounded-xl transition-all shadow-sm active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 group-hover:bg-rose-50 flex items-center justify-center transition-colors">
                      <Filter size={16} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-700 group-hover:text-rose-600 transition-colors">Selective Wipe Tool</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Choose specific godowns, dates, or suppliers to delete.</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
                </button>

                <button
                  onClick={() => {
                    confirmAction('Wipe Product Master', 'Are you absolutely sure you want to WIPE THE PRODUCT MASTER? This will delete all cached products.', () => {
                      clearProductMaster();
                      logActivity('Product Master Wipe', 'Admin cleared the product master cache.');
                      toast.success('Product Master cleared.');
                    });
                  }}
                  className="w-full group relative overflow-hidden flex items-center justify-between p-3.5 bg-white border border-slate-200 hover:border-rose-300 rounded-xl transition-all shadow-sm active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 group-hover:bg-rose-50 flex items-center justify-center transition-colors">
                      <PackageX size={16} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-700 group-hover:text-rose-600 transition-colors">Wipe Product Master</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Clear the central product cache used for autofill.</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
                </button>

                <button
                  onClick={handleMasterWipe}
                  className="w-full group relative overflow-hidden flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 hover:bg-rose-600 hover:border-rose-600 rounded-xl transition-all shadow-sm active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 group-hover:bg-rose-500 flex items-center justify-center transition-colors">
                      <Skull size={16} className="text-rose-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-rose-700 group-hover:text-white transition-colors">Factory Reset</div>
                      <div className="text-[10px] text-rose-500/80 group-hover:text-rose-200 mt-0.5 font-medium">Nuke all data. Reset to day zero.</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-rose-300 group-hover:text-rose-300 transition-colors" />
                </button>
              </div>
            </div>
          </section>
        )}

      {/* Modals */}
      {permissionsUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Manage Access Rights</h3>
              <button onClick={() => setPermissionsUser(null)} className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded-md border border-slate-200 shadow-sm transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 bg-white space-y-4">
              <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs uppercase">
                  {permissionsUser.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{permissionsUser.name}</div>
                  <div className="text-[10px] text-slate-500 font-medium">{permissionsUser.email}</div>
                </div>
              </div>
              
              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 pb-2">
                {/* Grant All / Reset shortcuts */}
                <div className="flex gap-2 pb-3 border-b border-slate-100">
                  <button
                    onClick={() => {
                      const all = PERMISSIONS_LIST.map(p => p.path);
                      setUserPermissions(permissionsUser.id, all);
                      logActivity('Change Permissions', `Granted ALL permissions to user ${permissionsUser.id}`);
                    }}
                    className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                  >
                    Grant All
                  </button>
                  <button
                    onClick={() => {
                      setUserPermissions(permissionsUser.id, ['/', '/zero-stock']);
                      logActivity('Change Permissions', `Reset permissions to default for user ${permissionsUser.id}`);
                    }}
                    className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                  >
                    Reset to Default
                  </button>
                </div>

                {/* Helper to render a group */}
                {([
                  { label: '📄 Page Access', filter: (p: any) => !p.path.startsWith('action:') },
                  { label: '📋 Daybook Actions', filter: (p: any) => p.path.startsWith('action:') && !p.path.includes('refill') && !p.path.includes('manage') },
                  { label: '📦 Inventory / Refill', filter: (p: any) => p.path.startsWith('action:refill') },
                  { label: '🏪 Master Data', filter: (p: any) => p.path.startsWith('action:manage') && !p.path.includes('users') },
                  { label: '👥 User Management', filter: (p: any) => p.path.startsWith('action:manage_users') },
                ] as { label: string; filter: (p: any) => boolean }[]).map(group => {
                  const items = PERMISSIONS_LIST.filter(group.filter);
                  if (!items.length) return null;
                  return (
                    <div key={group.label}>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{group.label}</h4>
                      <div className="space-y-0.5">
                        {items.map(p => {
                          const active = (userPermissions[permissionsUser.id] || ['/', '/zero-stock']).includes(p.path);
                          return (
                            <div key={p.path} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100 transition-colors">
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="text-xs font-semibold text-slate-800">{p.label}</div>
                                {'desc' in p && <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">{(p as any).desc}</div>}
                              </div>
                              <button
                                onClick={() => handleToggleUserPermission(permissionsUser.id, p.path)}
                                className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 shadow-inner ${active ? 'bg-blue-600' : 'bg-slate-200'}`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${active ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingGodownIndex !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Edit Godown</h3>
              <button onClick={() => setEditingGodownIndex(null)} className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded-md border border-slate-200 shadow-sm transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 bg-white space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Godown Name</label>
                <input 
                  type="text"
                  value={editingGodownName}
                  onChange={e => setEditingGodownName(e.target.value)}
                  className="w-full text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-sm"
                  placeholder="Enter godown name..."
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Main HQ</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Designate this as a primary store</p>
                </div>
                <button 
                  onClick={() => setEditingGodownIsMain(!editingGodownIsMain)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 shadow-inner ${editingGodownIsMain ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${editingGodownIsMain ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <button
                onClick={handleSaveGodownEdit}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm mt-2"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSupplierOldName !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Edit Supplier</h3>
              <button onClick={() => setEditingSupplierOldName(null)} className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded-md border border-slate-200 shadow-sm transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 bg-white space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Supplier Name</label>
                <input 
                  type="text"
                  value={editingSupplierNewName}
                  onChange={e => setEditingSupplierNewName(e.target.value)}
                  className="w-full text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-sm"
                  placeholder="Enter supplier name..."
                  autoFocus
                />
              </div>

              <button
                onClick={handleSaveSupplierEdit}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm mt-2"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {wipeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-rose-100 bg-rose-50/50">
              <div className="flex items-center gap-2 text-rose-600">
                <Flame size={18} strokeWidth={2.5} />
                <h3 className="font-bold text-sm">Selective Data Wipe</h3>
              </div>
              <button onClick={() => { 
                setWipeModalOpen(false); 
                setSelectedGodownsToWipe([]); 
                setSelectedSuppliersToWipe([]); 
                setSelectedDatesToWipe([]);
                setWipeProductMaster(false);
                setSuspendOtherUsers(false);
              }} className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded-md border border-slate-200 shadow-sm transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-5">
              {/* Daybook Sheets Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Daybook Sheets</h4>
                  <button 
                    onClick={() => setSelectedDatesToWipe(selectedDatesToWipe.length === dates.length ? [] : [...dates])}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    {selectedDatesToWipe.length === dates.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {dates.length === 0 && <div className="text-[10px] text-slate-400">No sheets found.</div>}
                  {dates.map(d => (
                    <button 
                      key={d} 
                      onClick={() => setSelectedDatesToWipe(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                      className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-left"
                    >
                      {selectedDatesToWipe.includes(d) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-300" />}
                      <span className="text-xs font-semibold text-slate-700">{d}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Godowns Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Godowns</h4>
                  <button 
                    onClick={() => setSelectedGodownsToWipe(selectedGodownsToWipe.length === configuredGodowns.length ? [] : [...configuredGodowns])}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    {selectedGodownsToWipe.length === configuredGodowns.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {configuredGodowns.length === 0 && <div className="text-[10px] text-slate-400">No godowns.</div>}
                  {configuredGodowns.map(g => (
                    <button 
                      key={g} 
                      onClick={() => setSelectedGodownsToWipe(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                      className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-left"
                    >
                      {selectedGodownsToWipe.includes(g) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-300" />}
                      <span className="text-xs font-semibold text-slate-700">{g}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Suppliers Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Suppliers</h4>
                  <button 
                    onClick={() => setSelectedSuppliersToWipe(selectedSuppliersToWipe.length === suppliers.length ? [] : [...suppliers])}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    {selectedSuppliersToWipe.length === suppliers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {suppliers.length === 0 && <div className="text-[10px] text-slate-400">No suppliers.</div>}
                  {suppliers.map(s => (
                    <button 
                      key={s} 
                      onClick={() => setSelectedSuppliersToWipe(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                      className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-left"
                    >
                      {selectedSuppliersToWipe.includes(s) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-300" />}
                      <span className="text-xs font-semibold text-slate-700">{s}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Other Actions Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">Other Actions</h4>
                <div className="space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  <button 
                    onClick={() => setWipeProductMaster(!wipeProductMaster)}
                    className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-left"
                  >
                    {wipeProductMaster ? <CheckSquare size={16} className="text-amber-600" /> : <Square size={16} className="text-slate-300" />}
                    <span className="text-xs font-semibold text-slate-700">Clear Product Master Cache</span>
                  </button>
                  <button 
                    onClick={() => setSuspendOtherUsers(!suspendOtherUsers)}
                    className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-left"
                  >
                    {suspendOtherUsers ? <CheckSquare size={16} className="text-rose-600" /> : <Square size={16} className="text-slate-300" />}
                    <span className="text-xs font-semibold text-slate-700">Suspend All Other Users</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => {
                  const hasSelection = selectedGodownsToWipe.length > 0 || 
                                     selectedSuppliersToWipe.length > 0 ||
                                     selectedDatesToWipe.length > 0 ||
                                     wipeProductMaster ||
                                     suspendOtherUsers;
                  if (!hasSelection) return;
                  
                  confirmAction('Selective Wipe', 'Wipe selected data?', async () => {
                    if (selectedGodownsToWipe.length > 0) {
                      const remainingGodowns = configuredGodowns.filter(g => !selectedGodownsToWipe.includes(g));
                      setConfiguredGodowns(remainingGodowns.length > 0 ? remainingGodowns : ['Main Store']);
                      
                      const { setMainGodowns } = useAppStore.getState();
                      setMainGodowns(mainGodowns?.filter(g => !selectedGodownsToWipe.includes(g)) || []);
                    }
                    
                    if (selectedSuppliersToWipe.length > 0) {
                      for (const s of selectedSuppliersToWipe) {
                        removeSupplier(s);
                      }
                    }

                    if (selectedDatesToWipe.length > 0) {
                      const newReports = { ...dailyReports };
                      let failed = 0;
                      for (const d of selectedDatesToWipe) {
                        delete newReports[d];
                        const res = await cloudDeleteDateReport(d);
                        if (!res.success) failed++;
                      }
                      useAppStore.setState({ dailyReports: newReports });
                      if (failed > 0) {
                        alert(`Wiped selected sheets, but ${failed} failed to delete from cloud.`);
                      }
                    }

                    if (wipeProductMaster) {
                      clearProductMaster();
                    }

                    if (suspendOtherUsers) {
                      for (const u of configuredUsers) {
                        if (u.id !== user?.uid && !u.is_disabled) {
                          await toggleProfileStatus(u.id, true);
                        }
                      }
                    }
                    
                    setWipeModalOpen(false);
                    setSelectedGodownsToWipe([]);
                    setSelectedSuppliersToWipe([]);
                    setSelectedDatesToWipe([]);
                    setWipeProductMaster(false);
                    setSuspendOtherUsers(false);
                    alert('Selected data wiped.');
                    logActivity('Selective Wipe', `Selective wipe executed. Godowns: ${selectedGodownsToWipe.length}, Suppliers: ${selectedSuppliersToWipe.length}, Dates: ${selectedDatesToWipe.length}, PM: ${wipeProductMaster}, Users Suspended: ${suspendOtherUsers}`);
                    triggerEventNotification('selective_wipe', {
                      title: '⚠ Selective Wipe Executed',
                      body: `Godowns: ${selectedGodownsToWipe.length}, Suppliers: ${selectedSuppliersToWipe.length}, Dates: ${selectedDatesToWipe.length} wiped by admin.`
                    }).catch(() => {});
                  });
                }}
                disabled={!(selectedGodownsToWipe.length > 0 || selectedSuppliersToWipe.length > 0 || selectedDatesToWipe.length > 0 || wipeProductMaster || suspendOtherUsers)}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:text-slate-500 transition-colors shadow-sm"
              >
                Execute Wipe
              </button>
            </div>
          </div>
        </div>
      )}

        {isSuperAdmin && activeTab === 'activity' && (
          <>
            <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-700">
                  <FileText size={20} className="text-indigo-600" />
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase">System Activity Log</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Audit trail for all major actions</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pb-4">
                {activityLogs.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-medium">No recent activity found.</p>
                  </div>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-1 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[11.5px] font-bold text-slate-800">{log.action}</span>
                          <span className="text-[10.5px] text-slate-500">{log.details}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {log.userName}
                          </span>
                          <span className="text-[9px] text-slate-400 mt-1 font-medium whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-card space-y-4 mt-4">
              <div className="flex items-center justify-between pb-3 border-b border-rose-100">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle size={20} className="text-rose-600" />
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase">System Diagnostics</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Internal error buffer</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pb-4">
                {getRecentErrors().length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-medium">No recent errors logged.</p>
                  </div>
                ) : (
                  getRecentErrors().map((err, idx) => (
                    <div key={idx} className="flex flex-col gap-1 p-3 rounded-xl border border-rose-100 bg-rose-50/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[11.5px] font-bold text-rose-800">{err.module} : {err.operation}</span>
                        <span className="text-[10.5px] text-rose-600 font-medium">{err.message}</span>
                        {err.error && <pre className="text-[9px] text-rose-500 mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(err.error, null, 2)}</pre>}
                        <span className="text-[9px] text-slate-400 mt-1">{new Date(err.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {isSuperAdmin && activeTab === 'notifications' && (
          <div className="space-y-4">
            <NotificationAdminPanel />
            <section className="bg-white rounded-2xl p-4 border border-teal-200/80 shadow-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-teal-100">
              <div className="flex items-center gap-2 text-teal-700">
                <Bell size={20} className="text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase">Push Notifications</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Manage alerts & FCM testing</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                Service Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status Card */}
              <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">Connection Status</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                    <span className="text-xs font-semibold text-slate-600">Permissions</span>
                    <span className={`text-[10px] font-mono px-2 py-1 rounded border ${fcmPermission === 'granted' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : fcmPermission === 'denied' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                      {fcmPermission.toUpperCase()}
                    </span>
                  </div>
                  
                  {(fcmPermission === 'default' || fcmPermission === 'prompt') && (
                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                      <p className="text-[11px] text-blue-800 mb-2 leading-relaxed">
                        Enable notifications to receive critical stock alerts. The browser requires you to click the button below to grant permission.
                      </p>
                      <button onClick={handleRequestPermission} className="w-full py-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-lg text-xs font-bold shadow-sm">
                        Enable Notifications
                      </button>
                    </div>
                  )}

                  {fcmPermission === 'granted' && (
                    <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 flex items-start gap-2">
                      <CheckSquare size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-emerald-800 mb-0.5">Notifications Enabled</p>
                        <p className="text-[10px] text-emerald-600/90 leading-relaxed">
                          Your device is fully registered. The FCM token is automatically managed in the background.
                        </p>
                      </div>
                    </div>
                  )}

                  {fcmPermission === 'denied' && (
                    <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-rose-800 mb-0.5">Notifications Blocked</p>
                        <p className="text-[10px] text-rose-600/90 leading-relaxed">
                          You have blocked notifications in your browser settings. Please click the padlock icon in your URL bar to unblock them.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Test Sender */}
              <div className="bg-teal-50/50 rounded-xl p-3.5 border border-teal-100 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-teal-900 mb-1.5 uppercase tracking-wide">Developer Test Sender</h4>
                  <p className="text-[11px] text-teal-700/80 leading-relaxed mb-4">
                    Send a test push notification directly to your device via Firebase Cloud Messaging. This helps verify that the push notification pipeline is fully functional.
                  </p>
                </div>
                
                <button
                  onClick={handleSendTestNotification}
                  disabled={testNotificationStatus === 'sending'}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5
                    ${testNotificationStatus === 'idle' ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 active:scale-[0.98]' : ''}
                    ${testNotificationStatus === 'sending' ? 'bg-teal-400 text-white cursor-not-allowed' : ''}
                    ${testNotificationStatus === 'success' ? 'bg-emerald-500 text-white' : ''}
                    ${testNotificationStatus === 'error' ? 'bg-rose-500 text-white' : ''}
                  `}
                >
                  {testNotificationStatus === 'idle' && <><Send size={14} /> Send Test Push Alert</>}
                  {testNotificationStatus === 'sending' && <><Loader2 size={14} className="animate-spin" /> Sending to FCM...</>}
                  {testNotificationStatus === 'success' && <><CheckSquare size={14} /> Alert Sent Successfully!</>}
                  {testNotificationStatus === 'error' && <><AlertTriangle size={14} /> Failed to Send</>}
                </button>
              </div>
            </div>
          </section>
          </div>
        )}

        {addUserModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2 text-slate-800">
                  <Users size={18} strokeWidth={2.5} className="text-blue-600" />
                  <h3 className="font-bold text-sm">Create New Account</h3>
                </div>
                <button onClick={() => setAddUserModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded-md border border-slate-200 shadow-sm transition-colors">
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleCreateUser} className="p-4 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Display Name</label>
                    <input 
                      required 
                      value={newUserName} 
                      onChange={e => setNewUserName(e.target.value)} 
                      type="text" 
                      placeholder="e.g. Rahul Kumar" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address
                      {isCheckingEmail && <span className="ml-2 text-[10px] text-blue-600 font-medium inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Checking availability...</span>}
                    </label>
                    <input 
                      required 
                      value={newUserEmail} 
                      readOnly
                      type="email" 
                      placeholder="Auto-generated" 
                      className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed focus:outline-none transition-colors" 
                    />
                    <p className="text-[10px] text-slate-500 mt-1">This email is auto-generated to ensure uniqueness across the system.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                    <input required value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} type="password" placeholder="At least 6 characters" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition-colors" minLength={6} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Account Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setNewUserRole('worker')} className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-bold transition-all ${newUserRole === 'worker' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        STAFF
                      </button>
                      <button type="button" onClick={() => setNewUserRole('admin')} className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-bold transition-all ${newUserRole === 'admin' ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        ADMIN
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2">
                  <button type="submit" disabled={isCreatingUser || isCheckingEmail} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm tracking-wide shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {isCreatingUser ? 'Creating Account...' : isCheckingEmail ? 'Checking Email...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
          </div>
        </div>
      </main>
    </div>
  );
};
