import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';

export const CalendarView: React.FC = () => {
  const navigate = useNavigate();
  const [currentDateView, setCurrentDateView] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const dailyReports = useAppStore(state => state.dailyReports);

  const changeMonth = (offset: number) => {
    setCurrentDateView(prev => offset > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleOpenWorkspace = (dateStr: string) => {
    navigate(`/workspace/${encodeURIComponent(dateStr)}`);
  };

  const monthStart = startOfMonth(currentDateView);
  const monthEnd = endOfMonth(monthStart);
  
  // To keep the grid 7 columns wide and starting on Sunday
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // go back to Sunday
  
  const endDate = new Date(monthEnd);
  if (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // go forward to Saturday
  }

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Compute selected date details
  const selectedDateStr = selectedDate ? format(selectedDate, 'dd/MM/yyyy') : null;
  const selectedReport = selectedDateStr ? dailyReports[selectedDateStr] : undefined;
  
  const selectedTotalSkus = selectedReport?.stats?.totalSkus ?? (selectedReport?.extracted?.length || 0);
  const selectedProcessed = selectedReport?.stats?.processedSkus ?? (selectedReport?.extracted?.filter(item => item.processed).length || 0);
  const pendingCount = Math.max(0, selectedTotalSkus - selectedProcessed);
  
  // Calculate 0 Stock (items with balanceQty <= 0)
  const zeroStockCount = selectedReport?.stats?.zeroStockSkus ?? (selectedReport?.extracted?.filter(item => item.balanceQty <= 0).length || 0);

  return (
    <div className="flex-1 px-3.5 pt-3.5 md:p-6 lg:p-8 pb-8 w-full bg-warmCanvas overflow-y-auto no-scrollbar animate-fade-in">
      <div className="md:grid md:grid-cols-[1fr_350px] lg:grid-cols-[1fr_400px] md:gap-6 lg:gap-8 flex flex-col space-y-3 md:space-y-0 h-full max-w-6xl mx-auto">
        {/* Left Column: Calendar */}
        <div className="space-y-3">
          {/* Month Navigator Bar */}
      <section className="bg-warmCard rounded-2xl p-2 px-3 shadow-card-warm border border-warmBorder flex items-center justify-between" data-purpose="month-controls">
        <button 
          onClick={() => changeMonth(-1)}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-warmBorder bg-warmMuted hover:bg-[#e8e2d5] text-navy-850 text-xs font-semibold active:scale-95 transition shadow-xs"
        >
          <span className="text-[11px]">◀</span>
        </button>
        <div 
          className="text-center flex-1 px-2 cursor-pointer"
          onClick={() => setCurrentDateView(new Date())}
        >
          <div className="flex items-center justify-center space-x-1.5">
            <h2 className="text-base font-extrabold text-navy-850 tracking-tight leading-tight">
              {format(currentDateView, 'MMM yyyy')}
            </h2>
            {isSameMonth(currentDateView, new Date()) && (
              <span className="px-1.5 py-0.5 rounded bg-mintGreen-50 text-mintGreen-700 text-[9px] font-bold border border-mintGreen-200 uppercase">Active</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Tap a date to inspect stock entries</p>
        </div>
        <button 
          onClick={() => changeMonth(1)}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-warmBorder bg-warmMuted hover:bg-[#e8e2d5] text-navy-850 text-xs font-semibold active:scale-95 transition shadow-xs"
        >
          <span className="text-[11px]">▶</span>
        </button>
      </section>

      {/* Calendar Grid Card */}
      <section className="bg-warmCard rounded-2xl p-3 shadow-card-warm border border-warmBorder" data-purpose="calendar-table">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2.5 pb-2 border-b border-warmBorder/70 font-bold text-[11px] text-slate-500 tracking-tight">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>
        
        {/* Dates Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const dateStr = format(day, 'dd/MM/yyyy');
            const isCurrentMonthDay = isSameMonth(day, currentDateView);
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
            
            const hasData = dailyReports[dateStr] !== undefined;
            const extractedCount = dailyReports[dateStr]?.stats?.totalSkus ?? (dailyReports[dateStr]?.extracted?.length || 0);

            if (!isCurrentMonthDay) {
              return (
                <div key={day.toISOString()} className="h-14 rounded-xl border border-dashed border-warmBorder/60 bg-warmMuted/40 flex flex-col items-center justify-center opacity-40">
                  <span className="text-xs font-semibold text-slate-400">{format(day, 'd')}</span>
                  <span className="text-[9px] text-slate-400">{format(day, 'MMM')}</span>
                </div>
              );
            }

            if (isSelected) {
              return (
                <button 
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  onDoubleClick={() => handleOpenWorkspace(format(day, 'dd/MM/yyyy'))}
                  className="h-14 rounded-xl border-2 border-accentBlue bg-blue-50/70 shadow-card-active flex flex-col items-center justify-between p-1 active:scale-95 transition relative"
                >
                  <div className="flex items-center justify-center space-x-0.5 mt-0.5 text-accentBlue">
                    <span className="text-xs font-black">{format(day, 'd')}</span>
                    <span className="text-[11px] font-bold leading-none">★</span>
                  </div>
                  {hasData ? (
                    <span className="inline-block px-1.5 py-[1px] rounded-full bg-blue-100 text-accentBlue font-mono text-[9px] font-bold leading-none mb-0.5 truncate max-w-full">
                      {extractedCount}
                    </span>
                  ) : (
                    <span className="text-[9px] text-accentBlue/60 font-normal mb-0.5">Blank</span>
                  )}
                </button>
              );
            }

            if (hasData) {
              return (
                <button 
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  onDoubleClick={() => handleOpenWorkspace(format(day, 'dd/MM/yyyy'))}
                  className="h-14 rounded-xl border-2 border-mintGreen-500 bg-mintGreen-50/80 hover:bg-mintGreen-100/70 flex flex-col items-center justify-between p-1 active:scale-95 transition"
                >
                  <span className="text-xs font-black text-mintGreen-800 mt-0.5">{format(day, 'd')}</span>
                  <span className="inline-block px-1.5 py-[1px] rounded-full bg-mintGreen-100 text-mintGreen-700 font-mono text-[10px] font-bold leading-none mb-0.5">
                    {extractedCount}
                  </span>
                </button>
              );
            }

            return (
              <button 
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                onDoubleClick={() => handleOpenWorkspace(format(day, 'dd/MM/yyyy'))}
                className="h-14 rounded-xl border border-warmBorder bg-white hover:border-slate-400 flex flex-col items-center justify-between p-1 active:scale-95 transition"
              >
                <span className="text-xs font-bold text-navy-850 mt-0.5">{format(day, 'd')}</span>
                <span className="text-[9px] text-slate-400 font-normal mb-0.5">Blank</span>
              </button>
            );
          })}
        </div>
      </section>

        </div>

        {/* Right Column: Selected Date Card */}
        <div className="mt-3 md:mt-0">
          {/* Dynamic Bottom Sheet Workspace Card */}
      {selectedDate && (
        <section className="bg-warmCard rounded-2xl p-4 shadow-card-warm border border-warmBorder transition-all duration-200" data-purpose="workspace-action-card">
          {/* Top Status & Date Header */}
          <div className="flex items-center justify-between border-b border-warmBorder/80 pb-3">
            <div className="flex-1 pr-2">
              <h3 className="text-sm font-extrabold text-navy-850 tracking-tight mt-0.5">
                {format(selectedDate, 'MMM d, yyyy')} · Daily Stock Sheet
              </h3>
            </div>
            {selectedTotalSkus > 0 ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-mintGreen-50 text-mintGreen-700 border border-mintGreen-200 shrink-0">
                Verified List
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                Blank Sheet
              </span>
            )}
          </div>

          {/* SKU Summary Stats Row */}
          <div className="grid grid-cols-3 gap-2 py-3">
            <div className="bg-warmCanvas rounded-xl py-2 px-1 border border-warmBorder text-center flex flex-col items-center justify-center">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Items</p>
              <p className="text-lg font-black font-mono text-navy-850 leading-tight mt-0.5">{selectedTotalSkus}</p>
            </div>
            <div className="bg-amber-50/50 rounded-xl py-2 px-1 border border-amber-200/60 text-center flex flex-col items-center justify-center">
              <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Pending</p>
              <p className="text-lg font-black font-mono text-amber-600 leading-tight mt-0.5">{pendingCount}</p>
            </div>
            <div className="bg-red-50/50 rounded-xl py-2 px-1 border border-red-200/60 text-center flex flex-col items-center justify-center">
              <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider">0 Stock</p>
              <p className="text-lg font-black font-mono text-red-600 leading-tight mt-0.5">{zeroStockCount}</p>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="space-y-2 pt-0.5">
            <button 
              onClick={() => {
                if (selectedDateStr) {
                  handleOpenWorkspace(selectedDateStr);
                }
              }}
              className="w-full py-3 px-3.5 rounded-xl bg-accentBlue hover:bg-blue-700 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-600/30 flex items-center justify-center space-x-1.5 active:scale-[0.98] transition"
            >
              <span className="truncate">Open Refill Sheet & Stock Register</span>
            </button>
          </div>
        </section>
      )}
        </div>
      </div>
    </div>
  );
};
