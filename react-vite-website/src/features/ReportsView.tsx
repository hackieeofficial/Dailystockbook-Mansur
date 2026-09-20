import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { FileText } from 'lucide-react';
import { PrintDialog } from '../components/PrintDialog';
import type { ExtractedItem, FinalTask } from '../types';

type ReportItem = (ExtractedItem | FinalTask) & {
  date: string;
  isSkipped: boolean;
  status?: string;
  id?: string;
  taskId?: string;
};

import { useShallow } from 'zustand/react/shallow';

export const ReportsView: React.FC = () => {
  const { dailyReports, configuredGodowns, configuredUsers } = useAppStore(useShallow(state => ({
    dailyReports: state.dailyReports,
    configuredGodowns: state.configuredGodowns,
    configuredUsers: state.configuredUsers
  })));
  const { cloudStatus } = useSyncStore();
  
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [userFilter, setUserFilter] = useState('ALL');
  const [godownFilter, setGodownFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Instead of using useAppStore().dailyReports for history, we use React Query!
  const { data: cloudReports, error: queryError } = useQuery({
    queryKey: ['reportsList', fromDate, toDate],
    queryFn: async () => {
      let query = supabase.from('daily_reports').select('date_str, data');
      
      if (fromDate && toDate) {
        const start = new Date(fromDate + 'T00:00:00');
        const end = new Date(toDate + 'T23:59:59');
        const requestedDates = [];
        let curr = new Date(start);
        while (curr <= end) {
          requestedDates.push(`${String(curr.getDate()).padStart(2, '0')}/${String(curr.getMonth() + 1).padStart(2, '0')}/${curr.getFullYear()}`);
          curr.setDate(curr.getDate() + 1);
        }
        
        if (requestedDates.length > 31) {
          throw new Error("Date range exceeds the maximum allowed limit of 31 days. Please select a narrower range.");
        }
        query = query.in('date_str', requestedDates);
      }
      const { data, error } = await query;
      if (error) throw error;
      
      const reportsMap: Record<string, any> = {};
      data?.forEach(row => {
        reportsMap[row.date_str] = row.data;
      });
      return reportsMap;
    },
    // We already have some reports locally (from the 30-day sync).
    // We can merge them.
  });

  const allReports = useMemo(() => {
    return { ...dailyReports, ...(cloudReports || {}) };
  }, [dailyReports, cloudReports]);

  const allWorkers = useMemo(() => {
    const set = new Set((configuredUsers || []).map(u => u.name));
    Object.values(allReports).forEach(r => {
      r.final?.forEach((t: any) => {
        if (t.refillBy) set.add(t.refillBy);
      });
    });
    return Array.from(set).sort();
  }, [configuredUsers, allReports]);

  // Compute
  const filteredData = useMemo(() => {
    const fDate = fromDate ? new Date(fromDate + 'T00:00:00') : null;
    const tDate = toDate ? new Date(toDate + 'T23:59:59') : null;

    let items: ReportItem[] = [];

    Object.entries(allReports).forEach(([dateStr, report]) => {
      let dObj: Date;
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        dObj = new Date(`${y}-${m}-${d}T00:00:00`);
      } else {
        dObj = new Date(dateStr + 'T00:00:00');
      }

      if (fDate && dObj < fDate) return;
      if (tDate && dObj > tDate) return;

      if (statusFilter === 'ALL' || statusFilter === 'skipped') {
        report.extracted?.forEach((item: any) => {
          if (item.refillStatus !== 'SKIPPED' && item.decisionType !== 'SKIP') return;
          if (userFilter !== 'ALL') {
            if (userFilter === 'unassigned' && item.refillBy) return;
            if (userFilter !== 'unassigned' && item.refillBy !== userFilter) return;
          }
          if (godownFilter !== 'ALL' && godownFilter !== 'to_decide') return;
          items.push({ ...item, date: dateStr, isSkipped: true, status: 'Skipped', refillQty: 0, godown: '' } as any);
        });
      }
      
      if (statusFilter !== 'skipped') {
        report.final?.forEach((task: any) => {
          if (task.status === 'Picked' as any) task.status = 'Pending';
          
          if (userFilter !== 'ALL') {
            if (userFilter === 'unassigned' && task.refillBy) return;
            if (userFilter !== 'unassigned' && task.refillBy !== userFilter && task.refillById !== userFilter) return;
          }

          if (godownFilter === 'to_decide') {
            if (task.godown) return;
          } else if (godownFilter !== 'ALL' && task.godown !== godownFilter) {
            return;
          }

          if (statusFilter === 'pending') {
            if (task.status === 'Completed') return;
          } else if (statusFilter === 'done') {
             if (task.status !== 'Completed') return;
          } else if (statusFilter !== 'ALL' && task.status !== statusFilter) {
            return;
          }

          items.push({ ...task, date: dateStr, isSkipped: false });
        });
      }
    });
    return items.sort((a, b) => {
      const dateA = a.date.split('/').reverse().join('');
      const dateB = b.date.split('/').reverse().join('');
      return dateB.localeCompare(dateA) || (a.godown || '').localeCompare(b.godown || '');
    });
  }, [allReports, fromDate, toDate, userFilter, godownFilter, statusFilter]);

  const totalItems = filteredData.length;
  const completedCount = filteredData.filter(t => !t.isSkipped && t.status === 'Completed').length;
  const pendingCount = filteredData.filter(t => !t.isSkipped && t.status !== 'Completed').length;
  
  const setPreset = (preset: 'today' | '30days') => {
    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      const past30Str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setFromDate(past30Str);
      setToDate(todayStr);
    }
  };

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const handlePrint = () => {
    setPrintDialogOpen(true);
  };

  return (
    <>
      <PrintDialog isOpen={printDialogOpen} onClose={() => setPrintDialogOpen(false)} tasks={filteredData as any} reportTitle="Global Filtered Report" reportDate={fromDate && toDate ? (fromDate === toDate ? fromDate : `${fromDate} - ${toDate}`) : 'All Time'} />
      <main className="w-full max-w-md md:max-w-none lg:max-w-6xl mx-auto pb-6 px-3 md:px-6 pt-3 md:pt-6 flex flex-col gap-3 overflow-x-hidden">
      {/* Header */}
      <header className="flex flex-col gap-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-black tracking-tight text-brand-navy uppercase min-w-0 truncate">
            Global Reports
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div aria-label="Date Range Switcher" className="inline-flex p-0.5 rounded-lg bg-slate-200/80 text-xs font-semibold text-slate-600 shadow-inner" role="group">
              <button 
                onClick={() => setPreset('today')}
                aria-pressed={fromDate === todayStr && toDate === todayStr} 
                className={`px-2.5 py-1 rounded-md transition-all focus:outline-none text-[11px] font-bold ${fromDate === todayStr && toDate === todayStr ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`} 
                type="button"
              >
                Today
              </button>
              <button 
                onClick={() => setPreset('30days')}
                aria-pressed={fromDate !== todayStr || toDate !== todayStr} 
                className={`px-2.5 py-1 rounded-md transition-all focus:outline-none text-[11px] font-bold ${(fromDate !== todayStr || toDate !== todayStr) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`} 
                type="button"
              >
                Last 30 Days
              </button>
            </div>
            <button onClick={handlePrint} className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-[#1e293b] hover:bg-[#0f172a] active:scale-95 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all focus:outline-none" data-purpose="print-btn" title="Print Report" type="button">
              <svg aria-hidden="true" className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span className="">Print</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="bg-white rounded-xl p-2 md:p-4 border border-brand-border shadow-xs flex flex-col md:flex-row md:items-end gap-1.5 md:gap-4" data-purpose="filter-panel">
        <div className="flex items-center gap-1.5 md:gap-4 md:flex-none">
          <div className="relative flex-1 flex flex-col gap-1 min-w-0">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">From</span>
            <div className="relative flex-1 flex items-center">
              <input value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full min-w-0 bg-[#f8fafc] border border-slate-200 text-slate-800 text-[11px] font-semibold rounded-md pl-2 pr-2 sm:pr-6 py-1 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors" type="date" aria-label="From date" />
            </div>
          </div>
          <div className="relative flex-1 flex flex-col gap-1 min-w-0">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">To</span>
            <div className="relative flex-1 flex items-center">
              <input value={toDate} onChange={e => setToDate(e.target.value)} className="w-full min-w-0 bg-[#f8fafc] border border-slate-200 text-slate-800 text-[11px] font-semibold rounded-md pl-2 pr-2 sm:pr-6 py-1 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors" type="date" aria-label="To date" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 md:flex md:flex-1 gap-1.5 md:gap-4 w-full">
          <div className="relative flex flex-col gap-1 min-w-0 md:flex-1 w-full">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Staff</span>
            <div className="relative w-full min-w-0">
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="w-full min-w-0 appearance-none bg-[#f8fafc] border border-slate-200 text-slate-800 text-[11px] font-semibold rounded-md pl-2 pr-5 py-1 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors">
                <option value="ALL">All Staff</option>
                {allWorkers.map(w => <option key={w} value={w}>{w}</option>)}
                <option value="unassigned">Unassigned</option>
              </select>
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </div>
            </div>
          </div>
          <div className="relative flex flex-col gap-1 min-w-0 md:flex-1 w-full">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Godown</span>
            <div className="relative w-full min-w-0">
              <select value={godownFilter} onChange={e => setGodownFilter(e.target.value)} className="w-full min-w-0 appearance-none bg-[#f8fafc] border border-slate-200 text-slate-800 text-[11px] font-semibold rounded-md pl-2 pr-5 py-1 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors">
                <option value="ALL">All Godowns</option>
                <option value="to_decide">To decide</option>
                {configuredGodowns.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </div>
            </div>
          </div>
          <div className="relative flex flex-col gap-1 min-w-0 md:flex-1 w-full">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Status</span>
            <div className="relative w-full min-w-0">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full min-w-0 appearance-none bg-[#f8fafc] border border-slate-200 text-slate-800 text-[11px] font-semibold rounded-md pl-2 pr-5 py-1 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors">
                <option value="ALL">All Status</option>
                <option value="pending">Pending</option>
                <option value="done">Done</option>
                <option value="skipped">Skipped</option>
              </select>
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {queryError && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-red-700 text-xs font-semibold shadow-sm animate-fade-in text-center">
          <p className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            {(queryError as Error).message}
          </p>
        </div>
      )}

      {/* Summary Stats Banner */}
      <section className="bg-white rounded-xl px-3 py-2 border border-brand-border shadow-xs flex flex-wrap items-center gap-2 justify-center" data-purpose="summary-stats-banner">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
          <div className="inline-flex items-center gap-1">
            <span className="inline-flex items-center justify-center bg-slate-100 border border-slate-300/80 px-1.5 py-0.5 rounded text-slate-800 font-bold text-[10px]">{totalItems}</span>
            <span className="text-slate-600 font-medium text-[11px]">items</span>
          </div>
          <span className="text-slate-300"></span>
          <div className="flex items-center gap-1 text-brand-pending font-bold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-pending inline-block"></span>
            <span className="">{pendingCount} pending</span>
          </div>
          <span className="text-slate-300"></span>
          <div className="flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="">{completedCount} done</span>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="flex flex-col gap-2.5 md:gap-4" data-purpose="ledger-item-list">
        {(cloudStatus === 'loading' || cloudStatus === 'connecting') ? (
          [...Array(5)].map((_, i) => (
            <article key={i} className="report-card bg-white rounded-xl p-3.5 border-l-4 border-l-slate-200 border border-brand-border shadow-card-warm flex flex-col gap-2.5 animate-pulse">
              <div className="flex items-center justify-between gap-2">
                <div className="w-1/2 h-5 rounded-md bg-slate-200"></div>
                <div className="w-16 h-4 rounded bg-slate-100"></div>
              </div>
              <div className="w-3/4 h-4 rounded-md bg-slate-100"></div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                <div className="flex gap-2">
                  <div className="w-12 h-4 rounded bg-slate-100"></div>
                  <div className="w-16 h-4 rounded bg-slate-100"></div>
                </div>
                <div className="w-16 h-5 rounded-full bg-slate-200"></div>
              </div>
            </article>
          ))
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-600 bg-white/50 rounded-xl border border-dashed border-slate-200">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <FileText size={24} className="text-slate-400" />
            </div>
            <p className="font-bold">No records found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          filteredData.map((item, idx) => {
            const isSkipped = item.isSkipped;
            const isDone = item.status === 'Completed';

          if (isSkipped) {
            return (
              <article key={`${item.date}-${item.id || (item as any).taskId}`} className="report-card bg-white/75 opacity-70 rounded-xl p-3.5 border border-dashed border-slate-300 shadow-none flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-black text-slate-400 font-mono">#{idx + 1}</span>
                    <h2 className="text-user-title font-bold text-slate-700 uppercase break-words flex-1 min-w-0 line-through decoration-slate-400" title={item.code}>{item.code}</h2>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">{item.date}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-tight -mt-1 break-words leading-tight">{item.brand} {item.category}</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[9px] uppercase tracking-wide border border-slate-200 whitespace-normal">{item.brand}</span>
                    <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200 text-[9px] whitespace-normal">{item.godown && item.godown !== '' ? item.godown : 'Unassigned'}</span>
                    {(item as any).refillBy && <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wide whitespace-normal">BY {(item as any).refillBy}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">QTY</span>
                      <span className="text-[10px] font-bold text-slate-400"></span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-600 border border-slate-300 uppercase">SKIPPED</span>
                  </div>
                </div>
              </article>
            );
          }

          return (
            <article key={`${item.date}-${item.id || (item as any).taskId}`} className="report-card bg-white rounded-xl p-3.5 border border-brand-border shadow-xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-black text-slate-400 font-mono">#{idx + 1}</span>
                  <h2 className="text-user-title font-black text-slate-900 uppercase break-words flex-1 min-w-0" title={item.code}>{item.code}</h2>
                </div>
                <span className="shrink-0 text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{item.date}</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-tight -mt-1 break-words leading-tight">{item.brand} {item.category}</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[9px] uppercase tracking-wide border border-slate-200 whitespace-normal">{item.brand}</span>
                  {item.godown && item.godown !== '' ? (
                    <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200/80 text-[9px] whitespace-normal">{item.godown}</span>
                  ) : (
                    <span className="inline-block px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 font-semibold border border-slate-200/80 text-[9px] whitespace-normal">Unassigned</span>
                  )}
                  {(item as any).refillBy && <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide whitespace-normal">BY {(item as any).refillBy}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">QTY</span>
                    <span className="text-[10px] font-bold text-slate-900">{(item as any).refillQty}</span>
                  </div>
                  {isDone ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">DONE</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 uppercase">PENDING</span>
                  )}
                </div>
              </div>
            </article>
          );
        })
        )}
      </section>
    </main>
    </>
  );
};
