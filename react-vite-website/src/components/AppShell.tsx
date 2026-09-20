import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useSyncStore } from '../store/useSyncStore';
import { Calendar, FileUp, BarChart3, Settings, PackageOpen, ShieldAlert, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cloudPullAll, flushPending } from '../lib/syncEngine';
import { GlobalConfirmDialog } from './GlobalConfirmDialog';

export const AppShell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { cloudStatus, saveInFlight, pullInFlight, isCloudOnline } = useSyncStore();
  const { userPermissions } = useAppStore();

  const mainScrollRef = React.useRef<HTMLDivElement>(null);
  const [showBackOnline, setShowBackOnline] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const prevOnlineRef = React.useRef(isCloudOnline);

  React.useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  React.useEffect(() => {
    if (!prevOnlineRef.current && isCloudOnline) {
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(t);
    }
    prevOnlineRef.current = isCloudOnline;
  }, [isCloudOnline]);

  React.useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const store = useSyncStore.getState();
      const hasPending = Object.keys(store.pendingSync).length > 0 || store.saveInFlight > 0;
      if (hasPending) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires this to show the prompt
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const activeTab = location.pathname;
  
  const isSyncing = cloudStatus === 'syncing' || cloudStatus === 'loading' || saveInFlight > 0 || pullInFlight > 0;

  const userPerms = user?.uid ? (userPermissions[user.uid] || ['/', '/zero-stock']) : [];
  const hasPerm = (path: string) => {
    if (user?.role === 'admin') return true;
    if (path === '/settings') return true;
    if (path === '/' || path.startsWith('/workspace')) return userPerms.includes('/');
    return userPerms.includes(path);
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await flushPending();
    await cloudPullAll();
    setIsRetrying(false);
  };

  // Initialize to 'default' (unknown) to avoid flash showing the banner on a page that already has permission
  const [fcmPermission, setFcmPermission] = React.useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'granted'; // No Notification API = no banner needed
  });

  React.useEffect(() => {
    if (!('Notification' in window)) return;
    // Update whenever the permission might have changed
    setFcmPermission(Notification.permission);

    // Watch for permission changes (supported in most modern browsers)
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then(status => {
        const onChange = () => setFcmPermission(Notification.permission);
        status.addEventListener('change', onChange);
        return () => status.removeEventListener('change', onChange);
      }).catch(() => {}); // Not all browsers support permissions.query for notifications
    }
  }, []);

  const handleEnablePush = async () => {
    const { requestFCMToken } = await import('../lib/firebase');
    const token = await requestFCMToken();
    // Always sync permission state after the request, whether granted or denied
    if ('Notification' in window) {
      setFcmPermission(Notification.permission);
    }
    if (token && user?.uid) {
       setFcmPermission('granted');
       const { supabase } = await import('../lib/supabase');
       await supabase.from('profiles').update({ fcm_token: token }).eq('id', user.uid);
    }
  };

  return (
    <div className="h-[100dvh] w-full pt-safe flex justify-center bg-warmCanvas font-sans text-navy-850 antialiased overflow-hidden select-none">
      <GlobalConfirmDialog />
      {/* Responsive Screen Container */}
      <div className="w-full max-w-md md:max-w-none mx-auto h-full bg-warmCanvas flex flex-col md:flex-row shadow-2xl relative overflow-hidden">
        
        {/* Network Status Banners */}
        {!isCloudOnline && (
          <div className="absolute top-0 left-0 w-full z-[60] animate-in slide-in-from-top duration-300">
            <div className="bg-amber-500 text-white px-4 py-1.5 flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-2">
                <ShieldAlert size={14} />
                <span className="text-[11px] font-bold tracking-wide">Offline mode active. Progress is saved locally.</span>
              </div>
              <button 
                onClick={handleRetry} 
                disabled={isRetrying}
                className="text-[10px] font-extrabold bg-amber-600 hover:bg-amber-700 px-2 py-0.5 rounded active:scale-95 transition-all flex items-center space-x-1"
              >
                <RefreshCw size={10} className={isRetrying ? 'animate-spin' : ''} />
                <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Push Notification Banner — shows when permission is not yet granted or denied */}
        {isCloudOnline && (fcmPermission === 'default' || fcmPermission === 'prompt') && (
          <div className="absolute top-0 left-0 w-full z-[59] animate-in slide-in-from-top duration-300">
            <div className="bg-blue-600 text-white px-4 py-1.5 flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                <span className="text-[11px] font-bold tracking-wide">Enable notifications for critical stock alerts</span>
              </div>
              <button 
                onClick={handleEnablePush} 
                className="text-[10px] font-extrabold bg-white text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded shadow-sm active:scale-95 transition-all"
              >
                Enable
              </button>
            </div>
          </div>
        )}
        
        {showBackOnline && (
          <div className="absolute top-0 left-0 w-full z-[60] animate-in slide-in-from-top fade-out duration-300">
            <div className="bg-emerald-600 text-white px-4 py-1.5 flex items-center justify-center space-x-2 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span className="text-[11px] font-bold tracking-wide">Back online, syncing...</span>
            </div>
          </div>
        )}

        {/* Floating Sync Status (Only shows when syncing and online) */}
        {isSyncing && isCloudOnline && !showBackOnline && (
          <div className="absolute top-4 right-4 z-50 animate-fade-in pointer-events-none">
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-navy-900/90 border border-slate-700/50 rounded-full shadow-lg backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-accentBlue animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-200 tracking-tight">Syncing...</span>
            </div>
          </div>
        )}

        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-200 shadow-sm shrink-0 z-40 overflow-y-auto">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="font-bold text-lg text-slate-800 tracking-tight">DailyStock</div>
            <div className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">v3.0</div>
          </div>
          
          <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
            <button 
              onClick={() => hasPerm('/') && navigate('/')}
              className={`flex items-center gap-3 py-3 px-4 rounded-xl transition font-semibold text-sm ${
                !hasPerm('/') ? 'opacity-40 cursor-not-allowed' :
                activeTab === '/' || activeTab.startsWith('/workspace') ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Calendar strokeWidth={activeTab === '/' || activeTab.startsWith('/workspace') ? 2.5 : 2} className="w-5 h-5" />
              <span>Daybook</span>
            </button>
            
            <button 
              onClick={() => hasPerm('/zero-stock') && navigate('/zero-stock')}
              className={`flex items-center gap-3 py-3 px-4 rounded-xl transition font-semibold text-sm ${
                !hasPerm('/zero-stock') ? 'opacity-40 cursor-not-allowed' :
                activeTab === '/zero-stock' ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <PackageOpen strokeWidth={activeTab === '/zero-stock' ? 2.5 : 2} className="w-5 h-5" />
              <span>Zero Stock</span>
            </button>
            
            <button 
              onClick={() => hasPerm('/upload') && navigate('/upload')}
              className={`flex items-center gap-3 py-3 px-4 rounded-xl transition font-semibold text-sm ${
                !hasPerm('/upload') ? 'opacity-40 cursor-not-allowed' :
                activeTab === '/upload' ? 'bg-blue-700 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <FileUp strokeWidth={activeTab === '/upload' ? 2.5 : 2} className={`w-5 h-5 ${activeTab === '/upload' ? 'text-blue-200' : 'text-slate-500'}`} />
              <span>Upload CSV</span>
            </button>
            
            <button 
              onClick={() => hasPerm('/reports') && navigate('/reports')}
              className={`flex items-center gap-3 py-3 px-4 rounded-xl transition font-semibold text-sm ${
                !hasPerm('/reports') ? 'opacity-40 cursor-not-allowed' :
                activeTab === '/reports' ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <BarChart3 strokeWidth={activeTab === '/reports' ? 2.5 : 2} className="w-5 h-5" />
              <span>Reports</span>
            </button>

          </nav>
          
          <div className="p-4 border-t border-slate-100">
            <button 
              onClick={() => hasPerm('/settings') && navigate('/settings')}
              className={`flex items-center gap-3 py-3 px-4 w-full rounded-xl transition font-semibold text-sm ${
                !hasPerm('/settings') ? 'opacity-40 cursor-not-allowed' :
                activeTab === '/settings' ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Settings strokeWidth={activeTab === '/settings' ? 2.5 : 2} className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main ref={mainScrollRef} className="flex-1 w-full overflow-y-auto overflow-x-hidden relative flex flex-col bg-warmCanvas scroll-smooth">
          {!hasPerm(activeTab) ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4">
                <ShieldAlert size={28} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Permission Denied</h2>
              <p className="text-sm text-slate-500 mt-2">You don't have access to this page. Please contact your administrator.</p>
            </div>
          ) : (
            <React.Suspense fallback={
              <div className="flex-1 p-4 space-y-4">
                <div className="w-1/3 h-6 rounded-md bg-slate-200 animate-pulse mb-6"></div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="w-1/2 h-5 rounded-md bg-slate-200 animate-pulse"></div>
                      <div className="w-12 h-5 rounded-full bg-slate-200 animate-pulse"></div>
                    </div>
                    <div className="w-3/4 h-4 rounded-md bg-slate-100 animate-pulse"></div>
                  </div>
                ))}
              </div>
            }>
              <Outlet />
            </React.Suspense>
          )}
        </main>
        
        {/* Bottom App Navigation (Mobile Only) */}
        <nav aria-label="Bottom App Navigation" className="md:hidden shrink-0 w-full bg-white border-t border-slate-200 px-3 py-2 z-40 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] flex items-center justify-around pb-safe">
          <button 
            onClick={() => hasPerm('/') && navigate('/')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition active:scale-95 flex-1 ${
              !hasPerm('/') ? 'opacity-30 cursor-not-allowed' :
              activeTab === '/' || activeTab.startsWith('/workspace') ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar strokeWidth={activeTab === '/' || activeTab.startsWith('/workspace') ? 2.5 : 2} className="w-6 h-6" />
            <span className={`text-[10px] tracking-tight mt-1 ${activeTab === '/' || activeTab.startsWith('/workspace') ? 'font-bold' : 'font-medium'}`}>Daybook</span>
          </button>
          
          <button 
            onClick={() => hasPerm('/zero-stock') && navigate('/zero-stock')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition active:scale-95 flex-1 ${
              !hasPerm('/zero-stock') ? 'opacity-30 cursor-not-allowed' :
              activeTab === '/zero-stock' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <PackageOpen strokeWidth={activeTab === '/zero-stock' ? 2.5 : 2} className="w-6 h-6" />
            <span className={`text-[10px] tracking-tight mt-1 ${activeTab === '/zero-stock' ? 'font-bold' : 'font-medium'}`}>0 Stock</span>
          </button>
          
          <button 
            onClick={() => hasPerm('/upload') && navigate('/upload')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition active:scale-95 flex-1 ${!hasPerm('/upload') ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <div className="w-6 h-6 relative flex items-center justify-center">
              <div className={`absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center border-4 border-slate-50 transition-all shadow-[0_-2px_10px_rgba(0,0,0,0.08)] ${
                activeTab === '/upload' ? 'bg-blue-700 text-white shadow-blue-600/40' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/30'
              }`}>
                <FileUp strokeWidth={2.5} className="w-6 h-6" />
              </div>
            </div>
            <span className={`text-[10px] tracking-tight mt-1 ${activeTab === '/upload' ? 'font-bold text-blue-600' : 'font-medium text-slate-400'}`}>Upload</span>
          </button>
          
          <button 
            onClick={() => hasPerm('/reports') && navigate('/reports')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition active:scale-95 flex-1 ${
              !hasPerm('/reports') ? 'opacity-30 cursor-not-allowed' :
              activeTab === '/reports' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BarChart3 strokeWidth={activeTab === '/reports' ? 2.5 : 2} className="w-6 h-6" />
            <span className={`text-[10px] tracking-tight mt-1 ${activeTab === '/reports' ? 'font-bold' : 'font-medium'}`}>Reports</span>
          </button>

          <button 
            onClick={() => hasPerm('/settings') && navigate('/settings')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition active:scale-95 flex-1 ${
              !hasPerm('/settings') ? 'opacity-30 cursor-not-allowed' :
              activeTab === '/settings' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings strokeWidth={activeTab === '/settings' ? 2.5 : 2} className="w-6 h-6" />
            <span className={`text-[10px] tracking-tight mt-1 ${activeTab === '/settings' ? 'font-bold' : 'font-medium'}`}>Settings</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
