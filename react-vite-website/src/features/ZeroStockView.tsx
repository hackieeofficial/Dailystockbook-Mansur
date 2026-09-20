import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/useAuthStore';
import { parse, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import type { ExtractedItem } from '../types';
import { exportPO } from '../utils/exportPO';

const CustomCalendar: React.FC<{
  availableDates: string[]; // "dd/MM/yyyy"
  selectedDateStr: string;
  dateCounts: Record<string, number>;
  onSelect: (dateStr: string) => void;
}> = ({ availableDates, selectedDateStr, dateCounts, onSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(
    selectedDateStr ? parse(selectedDateStr, 'dd/MM/yyyy', new Date()) : new Date()
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "dd/MM/yyyy";
  const days = eachDayOfInterval({
    start: startDate,
    end: endDate
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4 px-2">
        <button type="button" onClick={prevMonth} className="p-1 text-slate-600 hover:text-navy-900 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <span className="font-bold text-navy-900 text-sm">{format(currentMonth, 'MMMM yyyy')}</span>
        <button type="button" onClick={nextMonth} className="p-1 text-slate-600 hover:text-navy-900 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dayStr = format(day, dateFormat);
          const isAvailable = availableDates.includes(dayStr);
          const isSelected = selectedDateStr === dayStr;
          const isCurrentMonth = isSameMonth(day, monthStart);
          const today = isToday(day);

          const count = dateCounts[dayStr] || 0;

          return (
            <button
              key={day.toString()}
              type="button"
              onClick={() => isAvailable && onSelect(dayStr)}
              disabled={!isAvailable}
              className={`
                aspect-square flex flex-col items-center justify-center rounded-lg transition-colors
                ${!isCurrentMonth ? 'text-slate-300' : ''}
                ${isSelected ? 'bg-accentBlue text-white font-bold shadow-md' : ''}
                ${!isSelected && isAvailable ? 'bg-warmCanvas text-navy-900 font-semibold hover:bg-warmMuted cursor-pointer shadow-xs border border-warmBorder/50' : ''}
                ${!isSelected && !isAvailable ? 'text-slate-300 cursor-not-allowed opacity-40' : ''}
                ${today && !isSelected && !isAvailable ? 'border border-accentBlue/30 text-accentBlue/50' : ''}
                ${today && !isSelected && isAvailable ? 'border border-accentBlue text-accentBlue' : ''}
              `}
            >
              <span className="text-xs">{format(day, 'd')}</span>
              {isAvailable && count > 0 && (
                <span className={`text-[7px] font-bold block mt-0.5 leading-none ${isSelected ? 'text-blue-100' : 'text-red-500'}`}>{count} SKU</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};



export const ZeroStockView: React.FC = () => {
  const { dailyReports, suppliers, addSupplier, markItemForRefill, clearRefillStatus, userPermissions } = useAppStore(useShallow(state => ({
    dailyReports: state.dailyReports,
    suppliers: state.suppliers,
    addSupplier: state.addSupplier,
    markItemForRefill: state.markItemForRefill,
    clearRefillStatus: state.clearRefillStatus,
    userPermissions: state.userPermissions
  })));
  const { user } = useAuthStore();
  
  const hasPerm = (perm: string) => {
    if (user?.role === 'admin') return true;
    if (!user) return false;
    const perms = userPermissions[user.uid] || ['/', '/zero-stock'];
    return perms.includes(perm);
  };
  
  // Get all available dates that have reports
  const availableDates = Object.keys(dailyReports).sort((a, b) => {
    const dateA = parse(a, 'dd/MM/yyyy', new Date());
    const dateB = parse(b, 'dd/MM/yyyy', new Date());
    return dateB.getTime() - dateA.getTime();
  });

  const selectedDateStr = useAppStore(state => state.zeroStockSelectedDate);
  const setSelectedDateStr = useAppStore(state => state.setZeroStockSelectedDate);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local state to track un-refilled item dropdown selections
  const [selectedSupplierMap, setSelectedSupplierMap] = useState<Record<string, string>>({});
  
  // Global modal state
  const [activeSupplierModalItemId, setActiveSupplierModalItemId] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  
  const [addingSupplierForItemId, setAddingSupplierForItemId] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [isAddingSupplierToRefill, setIsAddingSupplierToRefill] = useState(false);

  const [isFetching, setIsFetching] = useState(false);
  const selectedReport = dailyReports[selectedDateStr];

  React.useEffect(() => {
    if (selectedDateStr && selectedReport && selectedReport._by === 'skeleton' && !isFetching) {
      const loadData = async () => {
        setIsFetching(true);
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase.from('daily_reports').select('data').eq('date_str', selectedDateStr).maybeSingle();
        setIsFetching(false);
        
        if (data && data.data) {
          const { mergeDailyReport } = await import('../utils/sync');
          const mg = mergeDailyReport(selectedReport, data.data, 'react-v1');
          useAppStore.getState().updateDailyReportLocal(selectedDateStr, mg.merged);
        }
      };
      loadData();
    }
  }, [selectedDateStr, selectedReport]);

  let zeroStockItems: ExtractedItem[] = useMemo(() => {
    return selectedReport?.extracted?.filter(
      (item) => (item.balanceQty || 0) <= 0
    ) || [];
  }, [selectedReport]);

  const dateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    availableDates.forEach(d => {
      const rep = dailyReports[d];
      if (rep) {
        if (rep.stats && rep.stats.zeroStockSkus !== undefined) {
          counts[d] = rep.stats.zeroStockSkus;
        } else if (rep.extracted) {
          counts[d] = rep.extracted.filter(item => (item.balanceQty || 0) <= 0).length;
        } else {
          counts[d] = 0;
        }
      }
    });
    return counts;
  }, [availableDates, dailyReports]);
  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase();
    zeroStockItems = zeroStockItems.filter(item => 
      item.brand.toLowerCase().includes(lowerQuery) || 
      item.category.toLowerCase().includes(lowerQuery) || 
      item.code.toLowerCase().includes(lowerQuery)
    );
  }

  const handleRefillClick = (item: ExtractedItem) => {
    let chosenSupplier = selectedSupplierMap[item.id] || item.assignedSupplier || '';
    if (chosenSupplier === 'new') {
      if (!hasPerm('action:manage_suppliers')) {
        alert('Permission denied. Ask an admin to add new suppliers.');
        return;
      }
      setAddingSupplierForItemId(item.id);
      setIsAddingSupplierToRefill(true);
      setNewSupplierName('');
      return; // Will finish in handleSaveNewSupplier
    } else if (!chosenSupplier) {
      alert("Please select a supplier first.");
      return;
    }
    markItemForRefill(selectedDateStr, item.id, chosenSupplier);
  };
  
  const handleSupplierChange = (itemId: string, val: string) => {
    if (val === 'new') {
      if (!hasPerm('action:manage_suppliers')) {
        alert('Permission denied. Ask an admin to add new suppliers.');
        return;
      }
      setAddingSupplierForItemId(itemId);
      setIsAddingSupplierToRefill(false);
      setNewSupplierName('');
    } else {
      setSelectedSupplierMap(prev => ({ ...prev, [itemId]: val }));
      setActiveSupplierModalItemId(null);
      setSupplierSearch('');
    }
  };

  const handleSaveNewSupplier = () => {
    const finalName = newSupplierName.trim();
    if (!finalName || !addingSupplierForItemId) {
      setAddingSupplierForItemId(null);
      return;
    }

    if (!suppliers.includes(finalName)) {
      addSupplier(finalName);
    }
    
    if (isAddingSupplierToRefill) {
      markItemForRefill(selectedDateStr, addingSupplierForItemId, finalName);
    } else {
      setSelectedSupplierMap(prev => ({ ...prev, [addingSupplierForItemId]: finalName }));
    }
    
    setAddingSupplierForItemId(null);
    setActiveSupplierModalItemId(null);
    setSupplierSearch('');
  };

  return (
    <div className="flex-1 px-3 md:px-6 pt-3 md:pt-6 space-y-2.5 md:space-y-4 w-full max-w-none lg:max-w-6xl mx-auto bg-warmCanvas overflow-y-auto no-scrollbar animate-fade-in pb-6 md:pb-8">
      {/* 1. Sleek Compact Header Bar (Merged Title, SKU Count, Micro Sync Status) */}
      <section className="flex items-center justify-between gap-2 px-0.5 pt-0.5">
        <div className="flex items-center space-x-2 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-xs shadow-red-400/50"></span>
          <h1 className="text-lg font-extrabold text-navy-850 tracking-tight leading-none">0 Stock Report</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-red-100/70 text-red-700 border border-red-200">
            {zeroStockItems.length} SKUs
          </span>
        </div>
        
        {/* Share Button at Top Right */}
        <button 
          type="button" 
          onClick={() => exportPO(zeroStockItems.filter(i => i.decisionType === 'ORDERED'), selectedDateStr)}
          disabled={zeroStockItems.filter(i => i.decisionType === 'ORDERED').length === 0}
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-xs transition ${
            zeroStockItems.filter(i => i.decisionType === 'ORDERED').length > 0 
            ? 'bg-accentBlue text-white hover:bg-blue-600 active:scale-95' 
            : 'bg-warmMuted text-slate-400 cursor-not-allowed border border-warmBorder'
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
          </svg>
          <span>Share {zeroStockItems.filter(i => i.decisionType === 'ORDERED').length > 0 && `(${zeroStockItems.filter(i => i.decisionType === 'ORDERED').length})`}</span>
        </button>
      </section>

      {/* 2. Consolidated Ergonomic Date & SKU Search Control Bar */}
      <section className="bg-white rounded-xl p-1.5 md:p-2 border border-warmBorder shadow-card-warm flex items-center gap-1.5 md:gap-3">
        {/* Compact Date Trigger */}
        <button 
          type="button" 
          onClick={() => setIsDateModalOpen(true)}
          className="flex items-center space-x-1.5 bg-warmCanvas/80 hover:bg-warmMuted/80 border border-warmBorder/80 px-2 py-1.5 rounded-lg text-left transition shrink-0 active:scale-95"
        >
          <svg className="w-3.5 h-3.5 text-accentBlue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <span className="text-xs font-bold font-mono text-navy-850 tracking-tight">{selectedDateStr || 'Select Date'}</span>
          <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        
        {/* Search Input directly inline */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-warmCanvas/40 border-0 rounded-lg pl-7 pr-2 py-1.5 text-xs text-navy-850 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-accentBlue focus:outline-none transition" 
            placeholder="Search SKU, barcode..." 
          />
        </div>
      </section>

      {/* SKU Card List with Supplier Attribution & Refill Workflow */}
      <div className="flex flex-col gap-2.5 md:gap-4 pb-3">
        {!selectedDateStr ? (
          <div className="md:col-span-2 lg:col-span-3 bg-warmMuted/50 border border-warmBorder/60 rounded-xl p-8 text-center mt-8 flex flex-col items-center justify-center">
            <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <p className="text-sm font-bold text-navy-900 mb-1">No Date Selected</p>
            <p className="text-xs font-medium text-slate-600">Tap to choose a date and view the 0 stock report.</p>
            <button type="button" onClick={() => setIsDateModalOpen(true)} className="mt-4 px-4 py-2 bg-accentBlue text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition">Choose Date</button>
          </div>
        ) : zeroStockItems.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 py-12 flex flex-col items-center justify-center text-center px-4 bg-white rounded-lg border border-slate-200 shadow-sm mt-4">
            <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 className="text-sm font-bold text-slate-700">All Good!</h3>
            <p className="text-[11px] text-slate-600 mt-1 max-w-[200px]">No zero stock items found for the selected date or current search.</p>
          </div>
        ) : (
          zeroStockItems.map((item, index) => (
            <div key={item.id} className="bg-white rounded-xl p-3 border border-warmBorder shadow-card-warm relative overflow-hidden transition active:scale-[0.99]">
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.decisionType === 'ORDERED' ? 'bg-amber-500' : 'bg-red-500'} rounded-l-xl`}></div>
              
              <div className="pl-1 space-y-2">
                {/* Brand & Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9.5px] font-semibold text-slate-700 tracking-tight break-words flex-1 leading-tight">
                    <span className="text-black font-extrabold mr-1.5">#{index + 1}</span>
                    {item.brand}  {item.category}
                  </span>
                </div>
                
                {/* Code & Pricing Row */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-navy-850 tracking-tight font-sans break-words leading-tight pr-2">{item.code}</h3>
                  <div className="flex items-center space-x-3 text-right shrink-0">
                    <div>
                      <span className="text-[8.5px] font-mono uppercase text-slate-400 block leading-tight">MRP</span>
                      <span className="text-user-price-primary font-bold font-mono text-navy-850">₹{item.mrp}</span>
                    </div>
                    <div>
                      <span className="text-[8.5px] font-mono uppercase text-slate-400 block leading-tight">Sale Rate</span>
                      <span className="text-user-price-primary font-bold font-mono text-accentBlue">₹{item.saleRate}</span>
                    </div>
                  </div>
                </div>

                {/* Supplier Attribution & Refill Action Row */}
                {item.assignedSupplier && item.decisionType === 'ORDERED' ? (
                  <div className="pt-1 border-t border-warmBorder/60 flex items-center justify-between gap-1.5">
                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-600 break-words">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="break-words font-medium">Supplier: <strong className="text-navy-850">{item.assignedSupplier || item.refillBy || 'Unknown Supplier'}</strong></span>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="px-1.5 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase shrink-0">
                        ORDERED
                      </span>
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          clearRefillStatus(selectedDateStr, item.id);
                        }}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-100 transition active:scale-95 shrink-0 flex items-center space-x-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                        <span>Undo</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1 border-t border-warmBorder/60 flex items-center gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <button 
                        type="button"
                        onClick={() => setActiveSupplierModalItemId(item.id)}
                        className="w-full flex items-center justify-between bg-warmCanvas/50 border border-warmBorder rounded-lg px-2 py-1.5 text-[10px] text-navy-900 focus:outline-none focus:ring-1 focus:ring-accentBlue focus:bg-white transition text-left"
                      >
                        <span className="break-words leading-tight pr-1">{selectedSupplierMap[item.id] || item.refillBy ? `Supplier: ${selectedSupplierMap[item.id] || item.refillBy}` : 'Select Supplier...'}</span>
                        <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </button>
                    </div>
                    
                    {/* Add to Order Button */}
                    <button 
                      type="button" 
                      onClick={() => handleRefillClick(item)}
                      className="py-1 px-2.5 rounded-lg bg-accentBlue hover:bg-blue-700 text-white text-[10px] font-bold flex items-center space-x-1 shadow-xs transition active:scale-95 shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path>
                      </svg>
                      <span>Order</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Global Supplier Modal */}
      {activeSupplierModalItemId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[75vh] animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b border-warmBorder bg-warmCanvas/30 flex items-center justify-between">
              <h3 className="font-bold text-navy-900 text-sm">Select Supplier</h3>
              <button type="button" onClick={() => { setActiveSupplierModalItemId(null); setSupplierSearch(''); }} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-2 border-b border-warmBorder bg-warmCanvas/10">
              <input 
                type="text"
                autoFocus
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
                placeholder="Search supplier..."
                className="w-full bg-white border border-warmBorder rounded-lg px-3 py-2 text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-accentBlue shadow-sm"
              />
            </div>
            
            <div className="overflow-y-auto flex-1 overscroll-contain p-2 space-y-1 bg-warmCanvas/5">
              <button 
                type="button"
                onClick={() => handleSupplierChange(activeSupplierModalItemId, '')}
                className="w-full text-left px-3 py-2.5 rounded-lg text-xs hover:bg-warmMuted text-slate-600 transition-colors flex items-center space-x-2"
              >
                <span className="w-2 h-2 rounded-full border border-slate-300"></span>
                <span>None / Clear Selection</span>
              </button>
              
              {suppliers.filter(s => s.toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSupplierChange(activeSupplierModalItemId, s)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs hover:bg-warmMuted text-navy-900 font-medium transition-colors flex items-center space-x-2"
                >
                  <span className={`w-2 h-2 rounded-full ${(selectedSupplierMap[activeSupplierModalItemId] || '') === s ? 'bg-accentBlue' : 'bg-emerald-500'}`}></span>
                  <span className="truncate">{s}</span>
                </button>
              ))}
              
              {suppliers.filter(s => s.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-slate-600 italic">
                  No suppliers found matching "{supplierSearch}"
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-warmBorder bg-warmCanvas/30">
              <button
                type="button"
                onClick={() => handleSupplierChange(activeSupplierModalItemId, 'new')}
                className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-lg bg-blue-50 text-accentBlue hover:bg-blue-100 text-xs font-bold transition-colors border border-blue-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                <span>Add New Supplier</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Date Modal */}
      {isDateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[60vh] animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b border-warmBorder bg-warmCanvas/30 flex items-center justify-between">
              <h3 className="font-bold text-navy-900 text-sm">Select Date</h3>
              <button type="button" onClick={() => setIsDateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-4 bg-white flex-1">
              <CustomCalendar 
                availableDates={availableDates}
                selectedDateStr={selectedDateStr}
                dateCounts={dateCounts}
                onSelect={(date) => { setSelectedDateStr(date); setIsDateModalOpen(false); }}
              />
            </div>
          </div>
        </div>
      )}

      {addingSupplierForItemId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Add New Supplier</h3>
              <button onClick={() => setAddingSupplierForItemId(null)} className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded-md border border-slate-200 shadow-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-4 bg-white space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Supplier Name</label>
                <input 
                  type="text"
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  className="w-full text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-sm"
                  placeholder="Enter supplier name..."
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveNewSupplier();
                  }}
                />
              </div>

              <button
                onClick={handleSaveNewSupplier}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm mt-2"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
