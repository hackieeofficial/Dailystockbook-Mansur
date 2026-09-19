import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { ExtractedItem, FinalTaskStatus } from '../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { playRefillSound } from '../../lib/sounds';

interface RefillDialogProps {
  item: ExtractedItem | null;
  onClose: () => void;
  dateStr: string;
}

export const RefillDialog: React.FC<RefillDialogProps> = ({ item, onClose, dateStr }) => {
  const { configuredGodowns, dailyReports, productMaster, configuredUsers, updateDailyReport, updateProductMasterEntry } = useAppStore();
  const { user } = useAuthStore();
  
  const [qtyStr, setQtyStr] = useState('');
  const [godown, setGodown] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (item) {
      const memoryGodown = productMaster[item.id]?.godown || item.godown || '';
      setGodown(memoryGodown);
    }
  }, [item, productMaster]);

  if (!item) return null;

  const memory = productMaster[item.id];
  const lastRefillText = memory && memory.refillBy ? `Last: ${memory.godown || '?'} by ${memory.refillBy}` : null;

  const handleConfirm = async () => {
    if (isProcessing) return;

    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Enter a valid refill quantity (numbers only).');
      return;
    }

    if (!user && configuredUsers.length > 0) {
      alert('Please sign in / select who is working before confirming refills.');
      return;
    }

    setIsProcessing(true);
    try {

    const report = dailyReports[dateStr];
    const finalItem = {
      taskId: 'task_' + Math.random().toString(36).substring(2, 11),
      originalId: item.id,
      brand: item.brand,
      code: item.code,
      category: item.category,
      mrp: item.mrp,
      saleRate: item.saleRate,
      balanceQty: item.balanceQty,
      opening: item.opening,
      soldQty: item.soldQty,
      purQty: item.purQty,
      refillQty: qty,
      godown: godown,
      refillBy: user ? user.name : (configuredUsers[0]?.name || 'Staff'),
      refillById: user ? user.id : (configuredUsers[0]?.id || 'unknown'),
      refillAt: new Date().toISOString(),
      status: 'Pending' as FinalTaskStatus
    };

    const updatedExtracted = report.extracted.map(p => {
      if (p.id === item.id) {
        return {
          ...p,
          processedGodown: godown,
          refillBy: finalItem.refillBy,
          refillById: finalItem.refillById,
          processed: true,
          decisionType: 'REFILL' as const,
          refillStatus: 'REFILLED' as const,
          decidedAt: Date.now()
        };
      }
      return p;
    });

    updateProductMasterEntry(item.id, {
      godown: godown || memory?.godown || '',
      refillBy: finalItem.refillBy,
      refillById: finalItem.refillById,
      refillAt: finalItem.refillAt
    });

    updateDailyReport(dateStr, {
      ...report,
      extracted: updatedExtracted as ExtractedItem[],
      final: [...report.final, finalItem],
      _at: Date.now(),
      _by: 'react-v1'
    });

    playRefillSound();
    onClose();
    } catch (err) {
      setIsProcessing(false);
      alert('An error occurred while confirming refill.');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const content = (
    <div className="flex flex-col gap-4 py-1">
      {/* Hidden button to trap auto-focus and prevent mobile keyboard from popping up automatically */}
      <button autoFocus className="opacity-0 absolute w-0 h-0 p-0 m-0" aria-hidden="true" type="button" tabIndex={0} />
      {/* Flattened Product Info */}
      <div className="flex flex-col bg-slate-50/50 rounded-lg p-3 border border-slate-100">
        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <span className="bg-slate-200/50 text-slate-700 px-1.5 py-0.5 rounded">{item.brand}</span>
          <span className="truncate">{item.category}</span>
        </div>
        <div className="font-black text-slate-900 leading-tight mb-2 text-sm uppercase">{item.code}</div>
        
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
          <span className="text-slate-500">OPN <strong className="text-slate-800">{item.opening}</strong></span>
          <span className="text-slate-300">·</span>
          {item.purQty > 0 && (
            <>
              <span className="text-blue-600">PUR <strong className="text-blue-700">{item.purQty}</strong></span>
              <span className="text-slate-300">·</span>
            </>
          )}
          <span className="text-slate-500">SOLD <strong className="text-slate-800">{item.soldQty}</strong></span>
          <span className="text-slate-300">·</span>
          <span className={item.balanceQty === 0 ? 'text-rose-600' : 'text-emerald-700'}>
            BAL <strong className={item.balanceQty === 0 ? 'text-rose-700' : 'text-emerald-800'}>{item.balanceQty}</strong>
          </span>
        </div>
        {lastRefillText && <div className="mt-2 text-[9px] font-semibold text-blue-600 uppercase tracking-wide">Last Action: {lastRefillText}</div>}
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Refill Quantity</label>
            <input 
              type="text" 
              inputMode="numeric"
              pattern="[0-9]*"
              value={qtyStr}
              onChange={e => setQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-900 focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-all shadow-sm"
              placeholder="0"
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
            />
          </div>
          {item.soldQty > 0 && (
            <div className="pt-5 shrink-0">
              <button 
                onClick={() => setQtyStr(String(item.soldQty))}
                className="px-3 py-2 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-sm whitespace-nowrap"
              >
                Use Sold ({item.soldQty})
              </button>
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Select Godown</label>
          <div className="flex flex-wrap gap-1.5">
            <button 
              onClick={() => setGodown('')}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-md border transition-all ${godown === '' ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              Unassigned
            </button>
            {configuredGodowns.map(g => (
              <button 
                key={g}
                onClick={() => setGodown(g)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-md border transition-all ${godown === g ? 'bg-[#00236f] text-white border-[#00236f] shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Always use Dialog, centered on screen, rounded nicely for mobile/desktop.
  return (
    <Dialog open={!!item} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[400px] p-0 rounded-2xl overflow-hidden gap-0 border-slate-200/90 shadow-xl bg-white">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-slate-100 bg-white">
          <DialogTitle className="text-sm font-black text-slate-900 tracking-tight">Confirm Refill</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-3 bg-white">
          <button className="sr-only" autoFocus type="button" aria-hidden="true">focus trap</button>
          {content}
        </div>
        <div className="px-4 pb-4 pt-2 bg-white flex flex-col gap-2">
          <button onClick={handleConfirm} disabled={isProcessing} className="w-full px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold bg-[#09090b] text-white rounded-lg hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {isProcessing ? 'Processing...' : 'Confirm Refill'}
          </button>
          <button onClick={onClose} disabled={isProcessing} className="w-full px-4 py-2 text-[11px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50">Cancel</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
