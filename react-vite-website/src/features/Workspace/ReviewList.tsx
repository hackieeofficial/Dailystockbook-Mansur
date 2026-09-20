import React, { useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import type { ExtractedItem } from '../../types';
import { Search, Undo2, CheckCircle } from 'lucide-react';
import { RefillDialog } from './RefillDialog';
import { playSkipSound, playUndoSound } from '../../lib/sounds';
import { confirmPrompt } from '../../store/useConfirmStore';

export const ReviewList: React.FC<{ dateStr: string }> = ({ dateStr }) => {
  const report = useAppStore(state => state.dailyReports[dateStr]);
  const { updateDailyReport, productMaster, logActivity, userPermissions } = useAppStore(useShallow(state => ({
    updateDailyReport: state.updateDailyReport,
    productMaster: state.productMaster,
    logActivity: state.logActivity,
    userPermissions: state.userPermissions
  })));
  
  const { user } = useAuthStore();
  
  const hasPerm = useCallback((perm: string) => {
    return user?.role === 'admin' || (userPermissions[user?.uid || ''] || ['/', '/zero-stock']).includes(perm);
  }, [user, userPermissions]);
  
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [refillModalItem, setRefillModalItem] = useState<ExtractedItem | null>(null);

  const allItems = React.useMemo(() => report?.extracted || [], [report?.extracted]);
  
  // Early return logic moved down to render phase to respect Rules of Hooks
  const isReportEmpty = !report || !report.extracted || report.extracted.length === 0;
  const uniqueBrands = ['ALL', ...Array.from(new Set(allItems.map(i => i.brand))).sort()];

  const filteredItems = allItems.filter(item => {
    const matchBrand = brandFilter === 'ALL' || item.brand === brandFilter;
    const matchStatus = statusFilter === 'ALL' ||
                        (statusFilter === 'PROCESSED' && item.processed) ||
                        (statusFilter === 'UNPROCESSED' && !item.processed);
    const matchSearch = (item.code || '').toLowerCase().includes(search.toLowerCase()) || 
                        (item.category || '').toLowerCase().includes(search.toLowerCase()) ||
                        (item.brand || '').toLowerCase().includes(search.toLowerCase());
    
    return matchBrand && matchStatus && matchSearch;
  });

  const processedCount = allItems.filter(i => i.processed).length;
  const refilledCount = allItems.filter(i => i.decisionType === 'REFILL').length;
  const skippedCount = allItems.filter(i => i.decisionType === 'SKIP').length;
  const pendingCount = allItems.length - processedCount;

  const handleSkip = useCallback((item: ExtractedItem) => {
    const stateReport = useAppStore.getState().dailyReports[dateStr];
    if (!stateReport) return;
    
    const updated = (stateReport.extracted || []).map(p => {
      if (p.id === item.id) {
        return {
          ...p,
          processed: true,
          decisionType: 'SKIP',
          refillStatus: 'SKIPPED',
          refillBy: user?.name || 'Unknown',
          refillById: user?.id,
          decidedAt: Date.now()
        };
      }
      return p;
    });
    updateDailyReport(dateStr, { ...stateReport, extracted: updated as ExtractedItem[], _at: Date.now(), _by: 'react-v1' });
    playSkipSound();
  }, [dateStr, updateDailyReport, user]);

  const handleUndo = useCallback(async (item: ExtractedItem) => {
    const isAdmin = hasPerm('action:daybook_undo_others');
    const isMine = !item.refillById || item.refillById === user?.id;
    
    if (!isAdmin && !isMine) {
      alert(`Locked: This was done by ${item.refillBy || 'someone else'}.\nOnly they or an Admin can undo it.`);
      return;
    }

    const confirmed = await confirmPrompt({
      title: item.decisionType === 'REFILL' ? 'Undo Refill' : 'Undo Skip',
      description: item.decisionType === 'REFILL' ? 'Undo this refill?\nIt will be removed from the Refill List.' : 'Undo this skip and reopen the item?',
      confirmText: 'Undo',
      isDestructive: false
    });
    if (!confirmed) return;

    const stateReport = useAppStore.getState().dailyReports[dateStr];
    if (!stateReport) return;

    const updated = (stateReport.extracted || []).map(p => {
      if (p.id === item.id) {
        const newItem = { ...p };
        newItem.processed = false;
        newItem.decisionType = null;
        newItem.refillStatus = null;
        delete newItem.processedGodown;
        delete newItem.refillBy;
        delete newItem.refillById;
        newItem.decidedAt = Date.now(); // Update timestamp so the "undo" action wins in sync
        delete newItem.assignedSupplier;
        return newItem;
      }
      return p;
    });

    const goneIds = (stateReport.final || []).filter(t => t.originalId === item.id && t.taskId).map(t => t.taskId);
    const newFinal = (stateReport.final || []).filter(t => t.originalId !== item.id);
    
    const newTombstones = { ...stateReport.tombstones };
    const now = Date.now();
    goneIds.forEach(id => { if (id) newTombstones[id] = now; });

    updateDailyReport(dateStr, { ...stateReport, extracted: updated as ExtractedItem[], final: newFinal, tombstones: newTombstones, _at: Date.now(), _by: 'react-v1' });
    playUndoSound();
  }, [dateStr, updateDailyReport, user, hasPerm]);

  const handleSkipAll = useCallback(async () => {
    const confirmed = await confirmPrompt({
      title: 'Skip All Pending',
      description: `Skip all ${pendingCount} remaining unprocessed items?`,
      confirmText: 'Skip All',
      isDestructive: true
    });
    if (!confirmed) return;
    const stateReport = useAppStore.getState().dailyReports[dateStr];
    if (!stateReport) return;
    const nowSkip = Date.now();
    const updated = (stateReport.extracted || []).map(p => {
      if (!p.processed) {
        return {
          ...p,
          processed: true,
          decisionType: 'SKIP',
          refillStatus: 'SKIPPED',
          refillBy: user?.name || 'Unknown',
          refillById: user?.id,
          decidedAt: nowSkip
        };
      }
      return p;
    });
    updateDailyReport(dateStr, { ...stateReport, extracted: updated as ExtractedItem[], _at: Date.now(), _by: 'react-v1' });
    playSkipSound();
  }, [dateStr, pendingCount, updateDailyReport, user]);

  const handleResetAll = useCallback(async () => {
    if (!hasPerm('action:daybook_reset')) {
      alert('Only Admin can reset a full date. Ask an admin.');
      return;
    }
    const confirmed = await confirmPrompt({
      title: 'Reset Entire Daybook',
      description: `Reset ALL items for ${dateStr} back to unreviewed?\nThis clears the Refill List for this date.`,
      confirmText: 'Reset Daybook',
      isDestructive: true
    });
    if (!confirmed) return;
    
    const stateReport = useAppStore.getState().dailyReports[dateStr];
    if (!stateReport) return;
    
    const nowReset = Date.now();
    const allIds = (stateReport.final || []).filter(t => t.taskId).map(t => t.taskId);
    
    const updated = (stateReport.extracted || []).map(p => {
      const newItem = { ...p };
      // Do NOT reset items that are managed by ZeroStockView (ORDERED)
      if (newItem.decisionType !== 'ORDERED') {
        newItem.processed = false;
        newItem.decisionType = null;
        newItem.refillStatus = null;
        delete newItem.processedGodown;
        delete newItem.refillBy;
        delete newItem.refillById;
        newItem.decidedAt = Date.now(); // Update timestamp so the "reset" action wins in sync
        delete newItem.assignedSupplier;
      }
      return newItem;
    });
    
    const newTombstones = { ...stateReport.tombstones };
    allIds.forEach(id => { if (id) newTombstones[id] = nowReset; });

    updateDailyReport(dateStr, { ...stateReport, extracted: updated as ExtractedItem[], final: [], tombstones: newTombstones, _at: Date.now(), _by: 'react-v1' });
    logActivity('Reset Daybook', `Reset all items for ${dateStr}`);
    import('../../lib/syncEngine').then(({ triggerEventNotification }) => {
      triggerEventNotification('report_reset', {
        title: 'Sheet Reset',
        body: `All items for ${dateStr} have been reset to unreviewed.`
      }).catch(() => {});
    });
  }, [dateStr, hasPerm, logActivity, updateDailyReport]);

  if (isReportEmpty) {
    return <div className="py-12 flex flex-col items-center justify-center text-xs text-muted-foreground bg-secondary/10 rounded-lg m-4 border border-border/50 border-dashed">No items extracted. Please re-upload PDF.</div>;
  }

  return (
    <div className="flex flex-col gap-0 w-full pb-28">

      {/* Slim High-Density Progress Telemetry Bar */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-md p-1.5 mb-1.5 mx-2 mt-2" data-purpose="progress-telemetry">
        <div className="flex items-center justify-between text-[10px] leading-tight">
          <div className="flex items-center space-x-1 font-medium flex-wrap gap-y-0.5">
            <span className="font-extrabold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">{processedCount}/{allItems.length}</span>
            <span className="text-slate-600 font-medium">done</span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-700 font-bold bg-blue-50 px-1 py-0.5 rounded">• {refilledCount} refill</span>
            <span className="text-slate-600 font-semibold bg-slate-200/70 px-1 py-0.5 rounded">• {skippedCount} skip</span>
            {allItems.filter(i => i.decisionType === 'ORDERED').length > 0 && (
              <span className="text-amber-700 font-semibold bg-amber-100/70 px-1 py-0.5 rounded">• {allItems.filter(i => i.decisionType === 'ORDERED').length} order</span>
            )}
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            {pendingCount > 0 && (
              <button onClick={handleSkipAll} className="text-[9px] font-bold text-slate-700 bg-white hover:bg-slate-100 active:scale-95 px-1.5 py-0.5 rounded border border-slate-300 shadow-sm transition-all" type="button">
                Skip all
              </button>
            )}
            {processedCount > 0 && (
              <button onClick={handleResetAll} className="text-[9px] font-semibold text-slate-400 hover:text-slate-700 px-1 py-0.5 transition-colors" type="button">
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-1 mx-2 md:mx-4 mb-2" data-purpose="compact-filters">
        <div className="flex items-center gap-1">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
              <Search size={12} />
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-[11px] pl-6 pr-2 py-1 bg-white border border-slate-200 rounded placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-sm"
              placeholder="Search item, code, category..."
            />
          </div>
          {/* Brand Dropdown */}
          <div className="relative w-28 shrink-0">
            <select
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              className="w-full text-[10px] font-bold bg-white border border-slate-200 rounded py-1 pl-1.5 pr-4 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none shadow-sm truncate"
            >
              {uniqueBrands.map(b => <option key={b} value={b}>{b === 'ALL' ? `All Brands (${allItems.length})` : b}</option>)}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5 text-slate-400">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </span>
          </div>
          {/* Status Dropdown */}
          <div className="relative w-24 shrink-0">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full text-[10px] font-bold bg-white border border-slate-200 rounded py-1 pl-1.5 pr-4 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none shadow-sm truncate"
            >
              <option value="ALL">All Status</option>
              <option value="UNPROCESSED">Pending ({pendingCount})</option>
              <option value="PROCESSED">Reviewed ({processedCount})</option>
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5 text-slate-400">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </span>
          </div>
        </div>
      </div>

      {/* Ultra-Dense Item Cards List */}
      <main className="flex-1 px-2 md:px-4 pb-4 flex flex-col gap-1.5 md:gap-4 space-y-1.5 md:space-y-0" data-purpose="item-density-list">
        {filteredItems.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-white rounded-lg border border-slate-200 shadow-sm mt-4">
            <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
              <Search size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No items match</h3>
            <p className="text-[11px] text-slate-600 mt-1 max-w-[200px]">Try adjusting your search or filters to see more results.</p>
          </div>
        )}
        {filteredItems.map((item, index) => {
          const memoryGodown = productMaster[item.id]?.godown;
          const isWarning = item.balanceQty === 0;
          const isRefilled = item.decisionType === 'REFILL';

          /* ── CARD: PROCESSED → REFILLED ── */
          if (item.processed && isRefilled) {
            return (
              <article key={`${item.id}-refilled`} className="relative overflow-hidden bg-emerald-50/70 rounded-md border border-emerald-300 p-2 shadow-sm animate-3d-flip" data-purpose="processed-refill-card">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] z-0">
                  <CheckCircle size={120} strokeWidth={2.5} className="text-slate-900" />
                </div>
                <div className="relative z-10">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-user-badge font-black text-emerald-700 font-mono">#{String(index + 1).padStart(2, '0')}</span>
                    <span className="px-1.5 py-0.5 bg-emerald-800 text-white text-user-badge font-black uppercase rounded tracking-wider">{item.brand}</span>
                    <span className="inline-flex items-center text-user-badge font-extrabold text-emerald-900 bg-emerald-200 border border-emerald-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                      ✓ Refilled → {item.processedGodown}
                    </span>
                  </div>
                  {item.purQty > 0 && (
                    <span className="text-[10px] font-extrabold text-emerald-800 font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap">+{item.purQty} PCS</span>
                  )}
                </div>
                <div className="mb-1">
                  <h2 className="text-user-title font-bold text-slate-900 leading-tight uppercase break-words">{item.code}</h2>
                  <p className="text-user-category text-slate-600 font-medium break-words leading-tight">{item.category}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/80">
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center divide-x divide-emerald-200 text-center font-mono flex-1 min-w-0">
                      <div className="pr-2 text-left">
                        <span className="block text-user-qty-label font-bold text-slate-400 uppercase tracking-tighter">OPN</span>
                        <span className="font-bold text-slate-800 text-user-qty leading-none">{item.opening}</span>
                      </div>
                      <div className="px-2 text-left">
                        <span className="block text-user-qty-label font-bold text-emerald-800 uppercase tracking-tighter">PUR</span>
                        <span className="font-black text-emerald-700 text-user-qty leading-none">{item.purQty > 0 ? `+${item.purQty}` : '-'}</span>
                      </div>
                      <div className="px-2 text-left">
                        <span className="block text-user-qty-label font-bold text-emerald-800 uppercase tracking-tighter">BAL</span>
                        <span className="font-black text-emerald-800 text-user-qty leading-none">{item.balanceQty}</span>
                      </div>
                      <div className="pl-2 text-left">
                        <span className="block text-user-qty-label font-bold text-slate-400 uppercase tracking-tighter">SALE RATE <span className="opacity-60 font-medium">/ MRP</span></span>
                        <span className="font-bold text-slate-700 text-[11px] leading-none">
                          {item.saleRate ? `₹${item.saleRate}` : '-'} <span className="text-user-price-primary-secondary  text-slate-400 font-normal">/ {item.mrp ? `₹${item.mrp}` : '-'}</span>
                        </span>
                      </div>
                    </div>
                    <span className="text-user-meta text-emerald-700/80 italic mt-1 text-left block">
                      {item.refillBy ? `By ${item.refillBy}` : 'Refilled'}
                      {item.decidedAt ? ` at ${new Date(item.decidedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                  </div>
                  <button onClick={() => handleUndo(item)} className="inline-flex items-center space-x-1 px-3 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300 shadow-sm active:scale-90 transition-all shrink-0" type="button">
                    <Undo2 size={11} className="text-slate-600" />
                    <span>Undo</span>
                  </button>
                </div>
                </div>
              </article>
            );
          }

          /* ── CARD: PROCESSED → ORDERED ── */
          if (item.processed && item.decisionType === 'ORDERED') {
            return (
              <article key={`${item.id}-ordered`} className="bg-amber-50/90 rounded-md border border-amber-300 p-2 shadow-sm animate-3d-flip" data-purpose="processed-ordered-card">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-[11px] font-black text-amber-700 font-mono">#{String(index + 1).padStart(2, '0')}</span>
                    <span className="px-1.5 py-0.5 bg-amber-600 text-white text-user-badge font-black uppercase rounded tracking-wider">{item.brand}</span>
                    <span className="inline-flex items-center text-[9px] font-bold text-amber-900 bg-amber-200 border border-amber-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                      ★ Ordered
                    </span>
                  </div>
                  <span className="text-[9px] text-amber-800 font-mono whitespace-nowrap">BAL: {item.balanceQty}</span>
                </div>
                <div className="mb-1">
                  <h2 className="text-user-title font-bold text-slate-900 leading-tight uppercase break-words">{item.code}</h2>
                  <p className="text-user-category text-slate-600 font-medium break-words leading-tight">{item.category}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-amber-200">
                  <span className="text-[9px] text-amber-700 italic break-words mr-2 font-medium">
                    {item.assignedSupplier ? `Supplier: ${item.assignedSupplier}` : 'Ordered'}
                    {item.decidedAt ? ` at ${new Date(item.decidedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                  {/* Intentionally missing Undo button here to keep ZeroStockView workflows isolated */}
                  <span className="text-[9px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">See 0-Stock Tab</span>
                </div>
              </article>
            );
          }

          /* ── CARD: PROCESSED → SKIPPED ── */
          if (item.processed && !isRefilled) {
            return (
              <article key={`${item.id}-skipped`} className="bg-slate-100/90 opacity-65 rounded-md border border-slate-300 p-2 transition-all hover:opacity-100 animate-3d-flip" data-purpose="processed-skipped-card">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-[11px] font-black text-slate-400 font-mono">#{String(index + 1).padStart(2, '0')}</span>
                    <span className="px-1.5 py-0.5 bg-slate-300 text-slate-700 text-user-badge font-black uppercase rounded tracking-wider">{item.brand}</span>
                    <span className="inline-flex items-center text-[9px] font-bold text-slate-700 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded whitespace-nowrap">
                      ✗Skipped
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono whitespace-nowrap">BAL: {item.balanceQty}</span>
                </div>
                <div className="mb-1">
                  <h2 className="text-user-title font-bold text-slate-600 line-through leading-tight uppercase break-words">{item.code}</h2>
                  <p className="text-[10px] text-slate-400 font-medium break-words leading-tight">
                    {item.category}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-[9px] text-slate-600 italic break-words mr-2">
                    {item.refillBy ? `By ${item.refillBy}` : 'Skipped'}
                    {item.decidedAt ? ` at ${new Date(item.decidedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                  <button onClick={() => handleUndo(item)} className="inline-flex items-center space-x-1 px-3 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 rounded border border-slate-300 shadow-sm active:scale-90 transition-all" type="button">
                    <Undo2 size={11} className="text-slate-600" />
                    <span>Undo</span>
                  </button>
                </div>
              </article>
            );
          }

          /* ── CARD: OUT OF STOCK (0 BAL, unprocessed) ── */
          if (isWarning) {
            return (
              <article key={`${item.id}-zerostock`} className="bg-red-50/60 rounded-md border-2 border-red-500 p-2 shadow-sm animate-3d-flip" data-purpose="zero-stock-card">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-[11px] font-black text-red-600 font-mono">#{String(index + 1).padStart(2, '0')}</span>
                    <span className="px-1.5 py-0.5 bg-red-700 text-white text-user-badge font-black uppercase rounded tracking-wider">{item.brand}</span>
                    <span className="inline-flex items-center space-x-1 text-[9px] font-black text-red-900 bg-red-200/90 border border-red-400 px-1.5 py-0.5 rounded animate-pulse whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
                      <span>OUT OF STOCK</span>
                    </span>
                  </div>
                </div>
                <div className="mb-1">
                  <h2 className="text-user-title font-black text-red-950 leading-tight break-words uppercase">{item.code}</h2>
                  <p className="text-user-category text-red-700 font-semibold break-words leading-tight">{item.category}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-red-200">
                  <div className="flex items-center divide-x divide-red-200 text-center font-mono flex-1 min-w-0">
                    <div className="pr-2 text-left">
                      <span className="block text-user-qty-label font-bold text-red-500 uppercase tracking-tighter">OPN</span>
                      <span className="font-bold text-slate-800 text-user-qty leading-none">{item.opening}</span>
                    </div>
                    <div className="px-2 text-left">
                      <span className="block text-user-qty-label font-bold text-red-500 uppercase tracking-tighter">SLD</span>
                      <span className="font-bold text-slate-800 text-user-qty leading-none">{item.soldQty}</span>
                    </div>
                    <div className="px-2 text-left">
                      <span className="block text-user-qty-label font-black text-red-700 uppercase tracking-tighter">BAL</span>
                      <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-black text-[10px] leading-none inline-block">{item.balanceQty} BAL</span>
                    </div>
                    <div className="pl-2 text-left">
                      <span className="block text-user-qty-label font-bold text-slate-600 uppercase tracking-tighter">SALE RATE <span className="opacity-60 font-medium">/ MRP</span></span>
                      <span className="font-bold text-slate-700 text-[11px] leading-none">
                        {item.saleRate ? `₹${item.saleRate}` : '-'} <span className="text-user-price-primary-secondary  text-slate-400 font-normal">/ {item.mrp ? `₹${item.mrp}` : '-'}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button onClick={() => handleSkip(item)} className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-100 rounded border border-red-200 active:scale-90 transition-all" type="button">Skip</button>
                    <button onClick={() => setRefillModalItem(item)} className="px-3.5 py-1 text-[11px] font-black text-white bg-red-600 hover:bg-red-700 rounded shadow-sm active:scale-90 transition-all" type="button">
                      Refill !
                    </button>
                  </div>
                </div>
              </article>
            );
          }

          /* ── CARD: NORMAL UNPROCESSED ── */
          /* ── CARD: NORMAL UNPROCESSED ── */
          return (
            <article key={`${item.id}-unprocessed`} className="bg-white rounded-md border border-slate-200 p-2 shadow-sm transition-all hover:border-blue-300 animate-3d-flip" data-purpose="unprocessed-card">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-[11px] font-black text-slate-400 font-mono">#{String(index + 1).padStart(2, '0')}</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-white text-user-badge font-black uppercase rounded tracking-wider">{item.brand}</span>
                  {memoryGodown ? (
                    <span className="inline-flex items-center text-[9px] font-bold text-amber-800 bg-amber-100/80 border border-amber-300 px-1.5 py-0.5 rounded whitespace-nowrap">
                      → {memoryGodown}
                    </span>
                  ) : null}
                </div>
              </div>
                <div className="mb-1">
                  <h2 className="text-user-title font-bold text-slate-900 leading-tight uppercase break-words">{item.code}</h2>
                  <p className="text-user-category text-slate-600 font-medium break-words leading-tight">{item.category}</p>
                </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <div className="flex items-center divide-x divide-slate-100 text-center font-mono flex-1 min-w-0">
                  <div className="pr-2 text-left">
                    <span className="block text-user-qty-label font-bold text-slate-400 uppercase tracking-tighter">OPN</span>
                    <span className="font-extrabold text-slate-800 text-user-qty leading-none">{item.opening}</span>
                  </div>
                  <div className="px-2 text-left">
                    <span className="block text-user-qty-label font-bold text-slate-400 uppercase tracking-tighter">SLD</span>
                    <span className="font-extrabold text-slate-800 text-user-qty leading-none">{item.soldQty}</span>
                  </div>
                  <div className={`px-2 text-left ${item.balanceQty <= 5 ? 'bg-amber-50 rounded' : 'bg-emerald-50/80 rounded'}`}>
                    <span className={`block text-[8px] font-black uppercase tracking-tighter ${item.balanceQty <= 5 ? 'text-amber-700' : 'text-emerald-800'}`}>BAL</span>
                    <span className={`font-black text-user-qty leading-none ${item.balanceQty <= 5 ? 'text-amber-800' : 'text-emerald-700'}`}>{item.balanceQty}</span>
                  </div>
                  <div className="pl-2 text-left">
                    <span className="block text-user-qty-label font-bold text-slate-400 uppercase tracking-tighter">SALE RATE <span className="opacity-60 font-medium">/ MRP</span></span>
                    <span className="font-bold text-slate-700 text-[11px] leading-none">
                      {item.saleRate ? `₹${item.saleRate}` : '-'} <span className="text-user-price-primary-secondary  text-slate-400 font-normal">/ {item.mrp ? `₹${item.mrp}` : '-'}</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <button onClick={() => handleSkip(item)} className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 active:scale-90 transition-all" type="button">
                    Skip
                  </button>
                  <button onClick={() => setRefillModalItem(item)} className="px-3.5 py-1 text-[11px] font-extrabold text-white bg-blue-700 hover:bg-blue-800 rounded shadow-sm active:scale-90 transition-all" type="button">
                    Refill
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center p-8 text-center text-slate-600 bg-white/50 rounded-xl border border-dashed border-slate-200 mt-4 mx-2">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <p className="font-bold text-slate-700">All caught up — nothing to review</p>
            <p className="text-xs mt-1">Check back later or adjust filters</p>
          </div>
        )}
      </main>

      {refillModalItem && (
        <RefillDialog item={refillModalItem} dateStr={dateStr} onClose={() => setRefillModalItem(null)} />
      )}
    </div>
  );
};
