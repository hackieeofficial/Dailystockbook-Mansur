import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSyncStore } from '../store/useSyncStore';

import { cloudDeleteDateReport } from '../lib/syncEngine';
import { logout, updateProfileRole, toggleProfileStatus, createNewUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getRecentErrors } from '../lib/logger';
import { LogOut, Plus, Trash2, Edit2, Users, ShieldAlert, PowerOff, Flame, Skull, RefreshCw, Store, Truck, FileText, Eraser, AlertTriangle, ArrowUp, ArrowDown, Settings2, X, CheckSquare, Square, Loader2, BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DisplaySettingsTab } from '../components/DisplaySettingsTab';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export const SettingsView: React.FC = () => {
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  const confirmAction = (title: string, description: string, onConfirm: () => void, isDestructive = true) => {
    setConfirmState({ open: true, title, description, onConfirm, isDestructive });
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
  const [activeTab, setActiveTab] = useState<'general' | 'advanced' | 'danger' | 'activity' | 'insights' | 'display'>(user?.role === 'admin' ? 'general' : 'display');

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
    });
  };

  const handleClearProductMaster = () => {
    if (!hasPerm('action:manage_data_product_master')) return;
    confirmAction('Clear Product Master', 'Clear Product Master Cache?\nThe system will forget all assigned godowns and will re-learn them from the next PDF.', () => {
      clearProductMaster();
      logActivity('Clear Product Master', 'Cleared the entire product godown/supplier cache.');
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
        logActivity('Change Status', `${!currentDisabled ? 'Suspended' : 'Enabled'} user ${targetId}`);
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
      }
    });
  };

  const handleDisableAllOtherUsers = async () => {
    confirmAction('Disable All Others', 'Disable all other users? This will block access for everyone except you.', async () => {
      for (const u of configuredUsers) {
        if (u.id !== user?.uid && !u.is_disabled) {
          await toggleProfileStatus(u.id, true);
        }
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
    } else {
      alert(`Error creating user: ${res.error}`);
    }
  };

  const PERMISSIONS_LIST = [
    // Page Access
    { path: '/', label: 'Daybook View' },
    { path: '/zero-stock', label: '0 Stock View' },
    { path: '/upload', label: 'Upload View' },
    { path: '/reports', label: 'Reports View' },
    { path: '/settings', label: 'Settings View' },
    
    // Specific Actions
    { path: 'action:upload_parse', label: 'Upload & Parse PDFs' },
    { path: 'action:daybook_delete', label: 'Delete Single Sheets' },
    { path: 'action:daybook_delete_all', label: 'Delete All Sheets' },
    { path: 'action:daybook_undo_others', label: 'Undo Others Actions' },
    { path: 'action:daybook_reset', label: 'Reset Full Sheet' },
    { path: 'action:manage_godowns', label: 'Manage Godowns' },
    { path: 'action:manage_suppliers', label: 'Manage Suppliers' },
    { path: 'action:manage_data_product_master', label: 'Clear Product Cache' },
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
            <nav className={`grid ${isSuperAdmin ? 'grid-cols-6 md:grid-cols-1' : (isAdmin ? 'grid-cols-5 md:grid-cols-1' : 'grid-cols-1')} bg-slate-200/70 md:bg-transparent p-1 md:p-0 rounded-xl gap-0.5 md:gap-2 text-xs font-medium`}>
              <button 
                onClick={() => setActiveTab('display')}
                className={`py-1.5 md:py-2.5 px-3 md:justify-start flex items-center justify-center gap-2 rounded-lg transition font-medium text-[11px] md:text-sm ${activeTab === 'display' ? 'bg-white md:bg-blue-50 text-blue-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Settings2 size={16} className={activeTab === 'display' ? 'text-blue-600' : 'text-slate-400'} />
                <span>Display</span>
              </button>
              
              {isAdmin && (
                <>
                  <button 
                    onClick={() => setActiveTab('general')}
                    className={`py-1.5 md:py-2.5 px-3 md:text-left rounded-lg transition font-medium text-[11px] md:text-sm ${activeTab === 'general' ? 'bg-white md:bg-blue-50 text-blue-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    General
                  </button>
                  <button 
                    onClick={() => setActiveTab('advanced')}
                    className={`py-1.5 md:py-2.5 px-3 md:text-left rounded-lg transition font-medium text-[11px] md:text-sm ${activeTab === 'advanced' ? 'bg-white md:bg-blue-50 text-blue-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    Advanced
                  </button>
                  <button 
                    onClick={() => setActiveTab('insights')}
                    className={`py-1.5 md:py-2.5 px-3 md:justify-start flex items-center justify-center gap-2 rounded-lg transition font-medium text-[11px] md:text-sm ${activeTab === 'insights' ? 'bg-white md:bg-purple-50 text-purple-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-purple-600'}`}
                  >
                    <BarChart2 size={16} className={activeTab === 'insights' ? 'text-purple-600' : 'text-purple-400'} />
                    <span>Insights</span>
                  </button>
                  {isSuperAdmin ? (
                    <>
                      <button 
                        onClick={() => setActiveTab('danger')}
                        className={`py-1.5 md:py-2.5 px-3 md:justify-start flex items-center justify-center gap-2 rounded-lg transition font-medium text-[11px] md:text-sm ${activeTab === 'danger' ? 'bg-white md:bg-rose-50 text-rose-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-rose-600'}`}
                      >
                        <Flame size={16} className={activeTab === 'danger' ? 'text-rose-600' : 'text-amber-500'} />
                        <span>Danger</span>
                      </button>
                      <button 
                        onClick={() => setActiveTab('activity')}
                        className={`py-1.5 md:py-2.5 px-3 md:text-left rounded-lg transition font-medium text-[11px] md:text-sm ${activeTab === 'activity' ? 'bg-white md:bg-indigo-50 text-indigo-700 font-bold shadow-xs md:shadow-none' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                      >
                        Activity
                      </button>
                    </>
                  ) : (
                    <div className="py-1.5 md:py-2.5 px-3 md:text-left rounded-lg transition font-medium text-[11px] md:text-sm text-slate-400 flex items-center justify-center cursor-not-allowed">
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
          <div className="space-y-4">
            <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
              <div className="flex items-center gap-2 text-purple-700 mb-4 pb-2 border-b border-purple-50">
                <BarChart2 size={20} className="text-purple-600" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase">Godown Activity Heatmap</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Task volume distributed by godown</p>
                </div>
              </div>
              <div className="h-64 w-full">
                {(() => {
                  const godownCounts: Record<string, number> = {};
                  Object.values(dailyReports).forEach(report => {
                    report.final?.forEach(task => {
                      if (task.godown) {
                        godownCounts[task.godown] = (godownCounts[task.godown] || 0) + 1;
                      }
                    });
                  });
                  const data = Object.entries(godownCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);

                  if (data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No activity data available.</div>;

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </section>

            <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
              <div className="flex items-center gap-2 text-indigo-700 mb-4 pb-2 border-b border-indigo-50">
                <PieChartIcon size={20} className="text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-slate-900 uppercase">Skipped Task Ratio</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Completed vs Skipped tasks across all operations</p>
                </div>
              </div>
              <div className="h-64 w-full">
                {(() => {
                  let pending = 0;
                  let completed = 0;
                  Object.values(dailyReports).forEach(report => {
                    report.final?.forEach(task => {
                      if (task.status === 'Pending') pending++;
                      else if (task.status === 'Completed') completed++;
                    });
                  });

                  if (pending === 0 && completed === 0) return <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No tasks available.</div>;

                  const data = [
                    { name: 'Completed', value: completed, color: '#10b981' }, // Emerald
                    { name: 'Pending/Skipped', value: pending, color: '#f43f5e' } // Rose
                  ];

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                          itemStyle={{ color: '#1e293b' }}
                        />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </section>
          </div>
        )}

        {isSuperAdmin && activeTab === 'danger' && (
          <section className="bg-white rounded-[20px] p-4 border border-rose-200 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-rose-50/30 to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 mb-3 z-10 relative">
              <Flame size={18} className="text-rose-600" strokeWidth={2.5} />
              <h3 className="text-[11px] font-bold tracking-wider text-rose-600 uppercase">Developer Reset Tool</h3>
            </div>
            
            <div className="flex flex-col gap-2.5 z-10 relative">
              <button 
                onClick={() => setWipeModalOpen(true)}
                className="w-full text-left px-4 py-3 text-[13px] font-semibold text-slate-700 bg-slate-50/80 hover:bg-slate-100 rounded-[14px] border border-slate-200/80 transition-colors flex items-center justify-between group"
              >
                <span>Selective Data Wipe</span>
                <span className="text-rose-500 group-hover:translate-x-1 transition-transform">?</span>
              </button>
              
              <button 
                onClick={handleDisableAllOtherUsers}
                className="w-full text-left px-4 py-3 text-[13px] font-semibold text-slate-700 bg-slate-50/80 hover:bg-slate-100 rounded-[14px] border border-slate-200/80 transition-colors"
              >
                Suspend All Other Users
              </button>
            </div>
            
            <div className="mt-5 pt-5 border-t border-dashed border-rose-200/80 z-10 relative text-center">
              <button 
                onClick={handleMasterWipe}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-xs font-bold text-white bg-[#f4003d] hover:bg-rose-700 active:scale-95 rounded-[12px] transition-all uppercase tracking-wider shadow-sm"
              >
                <Skull size={16} strokeWidth={2.5} /> MASTER WIPE (TOTAL RESET)
              </button>
              <p className="text-[10px] text-[#f4003d] font-medium mt-3 leading-tight px-2">
                Irreversible action. Deletes all sheets, memory, godowns, aliases, and suppliers.
              </p>
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
              
              <div className="space-y-4 h-[50vh] overflow-y-auto pr-3 custom-scrollbar pb-2">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Page Access</h4>
                  <div className="space-y-1">
                    {PERMISSIONS_LIST.filter(p => !p.path.startsWith('action:')).map(p => {
                      const active = (userPermissions[permissionsUser.id] || ['/', '/zero-stock']).includes(p.path);
                      return (
                        <div key={p.path} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100 transition-colors">
                          <span className="text-xs font-semibold text-slate-700">{p.label}</span>
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

                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Advanced Actions</h4>
                  <div className="space-y-1">
                    {PERMISSIONS_LIST.filter(p => p.path.startsWith('action:')).map(p => {
                      const active = (userPermissions[permissionsUser.id] || ['/', '/zero-stock']).includes(p.path);
                      return (
                        <div key={p.path} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100 transition-colors">
                          <span className="text-xs font-semibold text-slate-700">{p.label}</span>
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
      <ConfirmDialog 
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        isDestructive={confirmState.isDestructive}
        onConfirm={() => {
          setConfirmState(prev => ({ ...prev, open: false }));
          confirmState.onConfirm();
        }}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};
