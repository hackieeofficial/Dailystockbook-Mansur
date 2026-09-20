import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { FinalTask } from '../../types';
import { Package, Users, Printer, Warehouse, MapPinOff, Check } from 'lucide-react';
import { PrintDialog } from '../../components/PrintDialog';

export const DateReport: React.FC<{ dateStr: string }> = ({ dateStr }) => {
  const { dailyReports } = useAppStore();
  const [viewMode, setViewMode] = useState<'all' | 'by-worker'>('all');
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const report = dailyReports[dateStr];
  if (!report || !report.extracted || report.extracted.length === 0) {
    return <div className="py-12 flex flex-col items-center justify-center text-xs text-muted-foreground bg-secondary/10 rounded-lg m-4 border border-border/50 border-dashed">No items found for {dateStr}.</div>;
  }

  const allFinal = report.final || [];
  
  const totalItems = allFinal.length;
  const notDoneCount = allFinal.filter(t => t.status !== 'Completed').length;
  const completedCount = allFinal.filter(t => t.status === 'Completed').length;

  // Grouping by Worker
  const groupedByWorker = allFinal.reduce((acc, t) => {
    const worker = t.refillBy || 'Unassigned';
    if (!acc[worker]) acc[worker] = [];
    acc[worker].push(t);
    return acc;
  }, {} as Record<string, FinalTask[]>);

  // Grouping by Godown
  const groupedByGodown = allFinal.reduce((acc, t) => {
    const godown = t.godown || 'UNASSIGNED / MAIN';
    if (!acc[godown]) acc[godown] = [];
    acc[godown].push(t);
    return acc;
  }, {} as Record<string, FinalTask[]>);

  const renderRows = (tasks: FinalTask[], showWorker: boolean) => {
    return tasks.map((t, i) => {
      const isDone = t.status === 'Completed';
      return (
        <article key={t.taskId} className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-sm hover:shadow-md transition-shadow relative">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 font-mono">#{String(i + 1).padStart(2, '0')}</span>
              <h2 className="text-user-title font-black text-slate-900 tracking-tight leading-snug uppercase">{t.code}</h2>
            </div>
            {t.godown && t.godown !== '' ? (
              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 text-amber-700 border border-amber-300/70 rounded">{t.godown}</span>
            ) : (
              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 text-slate-500 border border-dashed border-slate-300 rounded">Unassigned</span>
            )}
          </div>
          <p className="text-[11px] font-medium text-slate-500 mb-3 uppercase">{t.brand} {t.category || ''}</p>
          <div className="flex items-center justify-between gap-2 pt-0 border-t-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 text-slate-600 rounded border border-slate-200 tracking-wider">{t.brand}</span>
              {showWorker && t.refillBy && <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide ml-0.5">BY {t.refillBy}</span>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-user-qty font-black text-slate-800 border border-slate-200 px-2 py-0.5 rounded">QTY <strong className="text-user-qty text-slate-950">{t.refillQty}</strong></span>
              {isDone ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-600 border border-emerald-300 px-2 py-0.5 rounded uppercase tracking-wider">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                  DONE
                </span>
              ) : (
                <span className="text-[10px] font-black text-amber-600 border border-amber-300 px-2 py-0.5 rounded uppercase tracking-wider">PENDING</span>
              )}
            </div>
          </div>
        </article>
      );
    });
  };

  const handlePrint = () => {
    setPrintDialogOpen(true);
  };

  return (
    <>
      <PrintDialog isOpen={printDialogOpen} onClose={() => setPrintDialogOpen(false)} tasks={(report?.final || []) as any} reportTitle="Daybook Refill Report" reportDate={dateStr} />
      <div className="flex flex-col gap-0 max-w-5xl mx-auto w-full pb-20">
      {/* Summary Banner & Controls */}
      <div className="bg-white px-1.5 sm:px-3 py-2 border-b border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex-shrink-0 z-10 mb-3 flex items-center justify-between gap-1 sm:gap-2">
        <div className="bg-slate-50 p-0.5 sm:p-1 rounded-lg flex items-center gap-0.5 sm:gap-1 border border-slate-200 text-[9px] sm:text-xs font-semibold shrink-0">
          <button 
            onClick={() => setViewMode('all')}
            className={`px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-md flex items-center gap-1 sm:gap-1.5 transition-all ${viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-200' : 'text-slate-600 hover:text-slate-900 font-medium'}`}
          >
            <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>All</span>
          </button>
          <button 
            onClick={() => setViewMode('by-worker')}
            className={`px-1.5 py-1 sm:px-3.5 sm:py-1.5 rounded-md flex items-center gap-1 sm:gap-1.5 transition-all ${viewMode === 'by-worker' ? 'bg-[#00236f] text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'}`}
          >
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>By Staff</span>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0 text-[8px] sm:text-[10px] font-bold bg-slate-50/80 px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-lg border border-slate-200">
          <span className="text-slate-700 flex items-center"><span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-[8px] sm:text-[10px] bg-white border border-slate-200 flex items-center justify-center shadow-xs">{totalItems}</span></span>
          <span className="w-px h-2.5 sm:h-3 bg-slate-300"></span>
          <span className="text-amber-600 flex items-center">{notDoneCount} PND</span>
          <span className="w-px h-2.5 sm:h-3 bg-slate-300"></span>
          <span className="text-[#059669] flex items-center">{completedCount} DONE</span>
        </div>

        <button onClick={handlePrint} className="shrink-0 px-2 py-1 sm:px-3.5 sm:py-1.5 bg-[#09090b] hover:bg-slate-800 text-white rounded-lg font-bold text-[9px] sm:text-xs shadow-sm active:scale-95 transition-all flex items-center gap-1 sm:gap-1.5">
          <Printer className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.2]" />
          <span>Print</span>
        </button>
      </div>

      {/* Data List */}
      <main className="flex-1 px-3 space-y-4">
        {viewMode === 'all' ? (
          <>
            {Object.keys(groupedByGodown).length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground bg-white rounded-xl border border-slate-200 shadow-sm">No items in the Refill List yet.</div>
            ) : (
              Object.keys(groupedByGodown).sort().map(godown => {
                const tasks = groupedByGodown[godown];
                const isUnassigned = godown === 'UNASSIGNED / MAIN';
                return (
                  <section key={godown} className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        {isUnassigned ? <MapPinOff className="w-3.5 h-3.5 text-slate-500" /> : <Warehouse className="w-3.5 h-3.5 text-slate-500" />}
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{godown}</span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">({tasks.length} SKUs)</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 space-y-2 md:space-y-0">
                      {renderRows(tasks, true)}
                    </div>
                  </section>
                );
              })
            )}
          </>
        ) : (
          <>
            {Object.keys(groupedByWorker).sort().map(worker => {
              const tasks = groupedByWorker[worker];
              const workerDone = tasks.filter(t => t.status === 'Completed').length;
              const progressPercent = Math.round((workerDone / tasks.length) * 100);
              const initial = worker.charAt(0).toUpperCase();
              return (
                <section key={worker} className="space-y-2 pt-1">
                  <div className="flex items-center justify-between bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-[#1e3a8a] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                        {initial}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">{worker}</h3>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">{tasks.length} Tasks Assigned</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200/60">
                        {workerDone} / {tasks.length} DONE
                      </span>
                      <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#059669] h-full transition-all" style={{ width: `${progressPercent}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 space-y-2 md:space-y-0 pl-1 mt-2">
                    {renderRows(tasks, false)}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
    </>
  );
};
