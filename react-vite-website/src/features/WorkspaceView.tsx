import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { ChevronLeft, Trash2, Calendar as CalendarIcon, CheckCircle, FileText, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { cloudDeleteDateReport } from '../lib/syncEngine';
import { ReviewList } from './Workspace/ReviewList';
import { FinalList } from './Workspace/FinalList';
import { DateReport } from './Workspace/DateReport';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useShallow } from 'zustand/react/shallow';

export const WorkspaceView: React.FC = () => {
  const { dateStr } = useParams<{ dateStr: string }>();
  const navigate = useNavigate();
  const decodedDate = decodeURIComponent(dateStr || '');
  
  const { report, userPermissions, logActivity } = useAppStore(useShallow(state => ({
    report: state.dailyReports[decodedDate],
    userPermissions: state.userPermissions,
    logActivity: state.logActivity
  })));
  
  const { cloudStatus } = useSyncStore();
  const { user } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'review' | 'final' | 'report'>('review');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset scroll position instantly on tab change
    if (scrollRef.current) {
      // Remove smooth scrolling temporarily if it exists to ensure instant jump
      scrollRef.current.style.scrollBehavior = 'auto';
      scrollRef.current.scrollTop = 0;
      
      // Use requestAnimationFrame to ensure it stays at top after render
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
          scrollRef.current.style.scrollBehavior = ''; // Restore default
        }
      });
    }
    // Also try resetting window/main just in case
    window.scrollTo(0, 0);
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTop = 0;
  }, [activeTab]);

  const hasPerm = (perm: string) => user?.role === 'admin' || (userPermissions[user?.uid || ''] || ['/', '/zero-stock']).includes(perm);

  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (cloudStatus === 'connecting' || cloudStatus === 'loading') return;

    if (decodedDate && (!report || report._by === 'skeleton')) {
      // Fetch on-demand for purely cloud architecture
      const loadData = async () => {
        setIsFetching(true);
        const { supabase } = await import('../lib/supabase');
        const { data, error } = await supabase.from('daily_reports').select('data').eq('date_str', decodedDate).maybeSingle();
        setIsFetching(false);
        
        if (error) {
          alert(`Network error fetching report for ${decodedDate}. Please check your connection.`);
          navigate('/');
          return;
        }

        if (data && data.data) {
          // Store it locally for this session so optimistic updates work
          useAppStore.getState().updateDailyReportLocal(decodedDate, data.data as any);
        } else {
          // Cloud data is actually missing. If we had a skeleton, clear it.
          if (report) {
            useAppStore.getState().deleteDailyReportLocal(decodedDate);
          }
          alert(`No sheet found for ${decodedDate}. It may have been deleted. Going back to calendar.`);
          navigate('/');
        }
      };
      loadData();
    }
  }, [report, decodedDate, navigate, cloudStatus]);

  const [isDeleting, setIsDeleting] = useState(false);

  if (isFetching) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accentBlue"></div>
        <p className="mt-4 text-sm text-slate-500 font-medium">Downloading report from cloud...</p>
      </div>
    );
  }

  if (!report || report._by === 'skeleton') return null;

  const handleDelete = () => {
    if (!hasPerm('action:daybook_delete')) {
      alert('Permission denied: you don\'t have the "Delete sheets" right. Ask an admin.');
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    const result = await cloudDeleteDateReport(decodedDate);
    setIsDeleting(false);
    
    if (result && !result.success) {
      alert(`Failed to delete sheet from cloud: ${result.error}\n\nPlease check your permissions and try again.`);
      setIsDeleteConfirmOpen(false);
      return;
    }
    
    // Only delete locally if cloud delete succeeds
    useAppStore.getState().deleteDailyReportLocal(decodedDate);
    
    logActivity('Delete Single Sheet', `Deleted daybook sheet for date: ${decodedDate} from workspace.`);
    navigate('/');
  };

  const pendingCount = report.extracted?.filter(i => !i.refillStatus).length || 0;
  const finalCount = report.final?.length || 0;
  return (
    <div className="flex flex-col h-full bg-background animate-fade-in relative">
      {isDeleting && (
        <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-4 rounded-xl shadow-lg border flex items-center space-x-3">
            <svg className="w-5 h-5 text-red-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            <span className="font-semibold text-slate-800 text-sm">Deleting permanently...</span>
          </div>
        </div>
      )}
      <div className="max-w-[1200px] w-full mx-auto flex flex-col h-full ds-surface bg-card shadow-sm">
        {/* BEGIN: TopHeader (Ultra-Dense Audit Bar) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-2.5 md:px-6 pt-2 md:pt-4 pb-1.5 md:pb-3 shadow-sm shrink-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-6 w-full">
            {/* Micro Top Row: Back, Date, Location & Reset */}
            <div className="flex items-center justify-between gap-1.5 mb-1.5 md:mb-0 w-full md:w-auto">
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => navigate('/')}
                aria-label="Back"
                className="p-1 rounded bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all tap-target"
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>

              <div className="flex items-center space-x-1.5 leading-none">
                <div className="p-1 bg-blue-50 text-blue-800 rounded">
                  <CalendarIcon size={14} strokeWidth={2} />
                </div>
                <div>
                  <div className="flex items-center space-x-1">
                    <h1 className="text-xs font-extrabold tracking-tight text-slate-900 font-mono">
                      {decodedDate}
                    </h1>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Floor Micro-actions */}
            <div className="flex items-center space-x-1">

              {hasPerm('action:daybook_delete') && (
                <button
                  onClick={handleDelete}
                  aria-label="Delete Sheet"
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent transition-colors tap-target"
                  title="Delete Sheet"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              )}
            </div>
            </div>

            {/* Segmented Pill Tabs (Audit Workflow) */}
            <nav aria-label="Review Workflow Tabs" className="flex p-0.5 bg-slate-100 rounded-md space-x-0.5 text-[11px] md:text-xs font-semibold text-slate-600 w-full md:w-auto md:min-w-[400px]">
              <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 flex items-center justify-center py-1 px-1.5 rounded transition-all ${
                activeTab === 'review'
                  ? 'bg-white text-blue-900 font-extrabold shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              <BarChart3 size={12} className={`mr-1 shrink-0 ${activeTab === 'review' ? 'text-blue-700' : 'text-slate-400'}`} strokeWidth={2.5} />
              <span>Review</span>
              <span className={`ml-1 px-1.5 py-[1px] text-[10px] rounded-full ${
                activeTab === 'review' ? 'bg-blue-100 text-blue-900 font-black' : 'bg-slate-200 text-slate-700 font-bold'
              }`}>
                {pendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('final')}
              className={`flex-1 flex items-center justify-center py-1 px-1.5 rounded transition-all ${
                activeTab === 'final'
                  ? 'bg-white text-blue-900 font-extrabold shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              <CheckCircle size={12} className={`mr-1 shrink-0 ${activeTab === 'final' ? 'text-blue-700' : 'text-slate-400'}`} strokeWidth={2.5} />
              <span>Final</span>
              <span className={`ml-1 px-1.5 py-[1px] text-[10px] rounded-full ${
                activeTab === 'final' ? 'bg-blue-100 text-blue-900 font-black' : 'bg-slate-200 text-slate-700 font-bold'
              }`}>
                {finalCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`flex-1 flex items-center justify-center py-1 px-1.5 rounded transition-all ${
                activeTab === 'report'
                  ? 'bg-white text-blue-900 font-extrabold shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              <FileText size={12} className={`mr-1 shrink-0 ${activeTab === 'report' ? 'text-blue-700' : 'text-slate-400'}`} strokeWidth={2.5} />
              <span>Report</span>
              </button>
            </nav>
          </div>
        </header>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-auto relative bg-background">
          {activeTab === 'review' && <ReviewList dateStr={decodedDate} />}
          {activeTab === 'final' && <FinalList dateStr={decodedDate} />}
          {activeTab === 'report' && <DateReport dateStr={decodedDate} />}
        </div>
      </div>
      
      <ConfirmDialog 
        open={isDeleteConfirmOpen} 
        title="Delete Daybook Sheet" 
        description={`Permanently delete ALL data for ${decodedDate}?\nThis cannot be undone.`}
        confirmText="Delete Permanently"
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
};
