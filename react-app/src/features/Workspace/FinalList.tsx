import React, { useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { FinalTaskStatus } from '../../types';
import { Check, CheckCheck, Undo2, Filter, Package, Search, CheckCircle } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useShallow } from 'zustand/react/shallow';

export const FinalList: React.FC<{ dateStr: string }> = ({ dateStr }) => {
  const report = useAppStore(state => state.dailyReports[dateStr]);
  const { configuredGodowns, updateDailyReport, updateProductMasterEntry, productMaster } = useAppStore(useShallow(state => ({
    configuredGodowns: state.configuredGodowns,
    updateDailyReport: state.updateDailyReport,
    updateProductMasterEntry: state.updateProductMasterEntry,
    productMaster: state.productMaster
  })));
  
  const { user } = useAuthStore();
  
  const [godownFilter, setGodownFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, title: '', description: '', onConfirm: () => {}, isDestructive: false });

  const confirmAction = (title: string, description: string, onConfirm: () => void, isDestructive = false) => {
    setConfirmState({ open: true, title, description, onConfirm, isDestructive });
  };

  const isReportEmpty = !report || !report.final || report.final.length === 0;
  const allFinal = React.useMemo(() => report?.final || [], [report?.final]);

  const filteredFinal = allFinal.filter(item => {
    const matchGodown = godownFilter === 'ALL' || (godownFilter === '__UNDECIDED__' ? !item.godown : item.godown === godownFilter);
    let matchStatus = true;
    if (statusFilter === 'NOT_DONE') matchStatus = item.status !== 'Completed';
    else if (statusFilter !== 'ALL') matchStatus = item.status === statusFilter;
    const matchSearch = search === '' || (item.code || '').toLowerCase().includes(search.toLowerCase()) || (item.brand || '').toLowerCase().includes(search.toLowerCase());
    
    return matchGodown && matchStatus && matchSearch;
  });

  const godownBaseList = allFinal.filter(item => godownFilter === 'ALL' || (godownFilter === '__UNDECIDED__' ? !item.godown : item.godown === godownFilter));
  const totalItems = godownBaseList.length;
  const totalUnits = godownBaseList.reduce((s, t) => s + (parseFloat(String(t.refillQty)) || 0), 0);
  const pendingCount = godownBaseList.filter(t => t.status !== 'Completed').length;
  const completedCount = godownBaseList.filter(t => t.status === 'Completed').length;

  // Sorting
  const sortedList = [...filteredFinal].sort((a, b) => (a.godown || '').localeCompare(b.godown || ''));

  const handleStatusChange = useCallback((taskId: string, newStatus: string) => {
    const updated = allFinal.map(t => {
      if (t.taskId === taskId) return { ...t, status: newStatus as FinalTaskStatus };
      return t;
    });
    updateDailyReport(dateStr, { ...report, final: updated, _at: Date.now(), _by: 'react-v1' });
  }, [allFinal, dateStr, report, updateDailyReport]);

  const handleBulkComplete = useCallback(() => {
    confirmAction('Mark All Completed', `Update all ${filteredFinal.length} items to "Completed"?`, () => {
      const ids = new Set(filteredFinal.map(t => t.taskId));
      const updated = allFinal.map(t => {
        if (ids.has(t.taskId)) return { ...t, status: 'Completed' as FinalTaskStatus };
        return t;
      });
      updateDailyReport(dateStr, { ...report, final: updated, _at: Date.now(), _by: 'react-v1' });
    });
  }, [allFinal, dateStr, filteredFinal, report, updateDailyReport, confirmAction]);

  const handleGodownChange = useCallback((taskId: string, originalId: string, newGodown: string) => {
    const updated = allFinal.map(t => {
      if (t.taskId === taskId) return { ...t, godown: newGodown };
      return t;
    });

    // Also update the extracted list processedGodown
    const updatedExtracted = report.extracted.map(p => {
      if (p.id === originalId && p.decisionType === 'REFILL') {
        return { ...p, processedGodown: newGodown };
      }
      return p;
    });

    // Also update product master memory
    const prev = productMaster[originalId] || {};
    updateProductMasterEntry(originalId, {
      godown: newGodown,
      refillBy: prev.refillBy || user?.name || undefined,
      refillById: prev.refillById || user?.id || undefined,
      refillAt: prev.refillAt || new Date().toISOString()
    });

    updateDailyReport(dateStr, { ...report, final: updated, extracted: updatedExtracted, _at: Date.now(), _by: 'react-v1' });
  }, [allFinal, dateStr, productMaster, report, updateDailyReport, updateProductMasterEntry, user]);

  if (isReportEmpty) {
    return <div className="py-12 flex flex-col items-center justify-center text-xs text-muted-foreground bg-secondary/10 rounded-lg m-4 border border-border/50 border-dashed">No items confirmed yet. Go to Review Items and click Refill.</div>;
  }

  return (
    <div className="flex flex-col bg-slate-50 w-full animate-in fade-in duration-200">
      {/* BEGIN: Progress Telemetry & Batch Bar */}
      <section className="bg-white border-b border-slate-300 px-2 py-1 shadow-sm relative z-10" data-purpose="progress-metrics-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-5 h-5 rounded bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shadow-sm leading-none">
              {totalItems}
            </span>
            <span className="text-xs font-extrabold text-slate-900 leading-none">
              items <span className="text-slate-600 font-semibold">({totalUnits} pcs)</span>
            </span>
            <span className="text-slate-300 text-xs">|</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800 leading-none">
              <span className={`w-1.5 h-1.5 rounded-full bg-amber-500 ${pendingCount > 0 ? 'animate-pulse' : ''}`}></span>
              {pendingCount} pending
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800 leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              {completedCount} done
            </span>
          </div>
          
          {/* Crisp Outlined CTA */}
          {pendingCount > 0 && (
            <button onClick={handleBulkComplete} className="inline-flex items-center gap-1 text-xs font-bold text-blue-900 bg-white hover:bg-blue-50 active:bg-blue-100 px-2 py-1 rounded border border-blue-700 transition-all shadow-sm shrink-0 active:scale-95 leading-none" type="button">
              <CheckCheck size={14} strokeWidth={2.5} className="text-blue-800" />
              <span>Complete all</span>
            </button>
          )}
        </div>
      </section>

      {/* BEGIN: Quick Filter Strip */}
      <section className="bg-slate-100/90 px-2 py-1 border-b border-slate-300 flex items-center gap-1.5" data-purpose="quick-filter-strip">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
             <Package size={14} className="text-slate-600" />
          </div>
          <select value={godownFilter} onChange={e => setGodownFilter(e.target.value)} className="w-full block pl-7 pr-6 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%228%22%3E%3Cpath%20d%3D%22M1%201l6%206%206-6%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_6px_center]">
            <option value="ALL">All godowns</option>
            <option value="__UNDECIDED__">To decide</option>
            {configuredGodowns.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
             <Filter size={14} className="text-slate-600" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full block pl-7 pr-6 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%228%22%3E%3Cpath%20d%3D%22M1%201l6%206%206-6%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_6px_center]">
            <option value="ALL">All status</option>
            <option value="Pending">Pending</option>
            <option value="NOT_DONE">Not Done</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        
        <div className="relative flex-shrink-0 w-28 group">
          <div className="absolute inset-y-0 left-0 pl-1.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500">
             <Search size={14} />
          </div>
          <input 
             type="text" 
             placeholder="Search..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded pl-6 pr-2 py-1 shadow-sm hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 placeholder:font-medium"
          />
        </div>
      </section>

      {/* BEGIN: Item Ledger Cards List */}
      <main className="flex-1 p-3 space-y-2.5 bg-slate-50" data-purpose="ledger-sheet-items">
        {sortedList.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-white rounded-lg border border-slate-200 shadow-sm mx-2 mt-2">
            <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
              <Search size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No items found</h3>
            <p className="text-[11px] text-slate-600 mt-1 max-w-[200px]">No items match the current filters. Try selecting a different godown or status.</p>
          </div>
        )}
        
        {sortedList.map((item, idx) => {
          const isCompleted = item.status === 'Completed';

          return (
            <article key={item.taskId} className={`bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden border-l-4 animate-3d-flip ${isCompleted ? 'border-l-emerald-600 bg-emerald-50/20' : 'border-l-amber-500'}`} data-purpose="item-ledger-card">
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {/* SKU Badge */}
                    <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 border ${isCompleted ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white leading-none">{item.brand}</span>
                        {isCompleted && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 leading-none">Verified</span>
                        )}
                      </div>
                      <h2 className="text-user-title font-black text-slate-950 leading-snug tracking-tight">{item.code}</h2>
                      <p className="text-[11px] font-medium text-slate-600 leading-tight mt-0.5">{item.category}</p>
                    </div>
                  </div>
                  
                  {/* High-Contrast Quantity Monospace Chip */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">QTY</span>
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded bg-slate-900 text-white shadow-sm inline-block leading-none">
                      {String(item.refillQty).padStart(2, '0')}
                    </span>
                  </div>
                </div>
                
                {/* Structured Attributes & Actions Row */}
                <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-slate-200 gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Godown Field */}
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">GODOWN</span>
                      {isCompleted ? (
                         <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold">
                           {item.godown || 'Unassigned'}
                         </span>
                      ) : (
                         <div className="relative">
                           <select 
                             value={item.godown || ''} 
                             onChange={e => handleGodownChange(item.taskId, item.originalId, e.target.value)}
                             className={`inline-flex items-center gap-1 pl-2 pr-6 py-0.5 rounded border text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer appearance-none transition-all ${item.godown ? 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200' : 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'}`}
                           >
                             <option value="">⚠️ Assign Godown</option>
                             {configuredGodowns.map(g => <option key={g} value={g}>{g}</option>)}
                           </select>
                           <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center pointer-events-none">
                             <span className="text-[10px] text-amber-600">▾</span>
                           </div>
                         </div>
                      )}
                    </div>
                    
                    {/* Staff Tag */}
                    {item.refillBy && (
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">STAFF</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-[10px] font-extrabold uppercase">
                          {item.refillBy}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  {isCompleted ? (
                    <button onClick={() => handleStatusChange(item.taskId, 'Pending')} aria-label="Undo item verification" className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 border border-slate-300 transition-all shrink-0" type="button">
                      <Undo2 size={14} strokeWidth={2.2} className="text-slate-600" />
                      <span>Undo</span>
                    </button>
                  ) : (
                    <button onClick={() => handleStatusChange(item.taskId, 'Completed')} className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-lg flex items-center gap-1.5 shadow-sm transition-all shrink-0" type="button">
                      <Check size={14} strokeWidth={3} />
                      <span>DONE</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </main>

      {filteredFinal.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-600 bg-white/50 rounded-xl border border-dashed border-slate-200 mt-4 mx-2">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
            <CheckCircle size={24} className="text-emerald-500" />
          </div>
          <p className="font-bold text-slate-700">All caught up</p>
          <p className="text-xs mt-1">No items match the current filters</p>
        </div>
      )}
      
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
