import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, Users, Target, Activity, Box, Medal, Star, Package, ShoppingCart } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e'];

export const AnalyticsView: React.FC = () => {
  const { dailyReports } = useAppStore();

  const { 
    totalItems, 
    totalCompleted, 
    completionRate,
    godownData,
    workerData,
    trendData,
    pieData,
    categoryData,
    topItems
  } = useMemo(() => {
    let tItems = 0;
    let tCompleted = 0;
    const gCounts: Record<string, number> = {};
    const wStats: Record<string, { completed: number; total: number }> = {};
    const tCounts: Record<string, number> = {};
    const cCounts: Record<string, number> = {};
    const iCounts: Record<string, { brand: string; code: string; count: number }> = {};

    Object.entries(dailyReports).forEach(([date, report]) => {
      let dateObj: Date;
      if (date.includes('/')) {
        const [d, m, y] = date.split('/');
        dateObj = new Date(`${y}-${m}-${d}`);
      } else {
        dateObj = new Date(date);
      }
      const shortDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      if (!tCounts[shortDate]) tCounts[shortDate] = 0;

      report.extracted?.forEach(item => {
        tItems++;
        if (item.refillBy) {
          if (!wStats[item.refillBy]) wStats[item.refillBy] = { completed: 0, total: 0 };
          wStats[item.refillBy].total++;
        }
      });

      report.final?.forEach(task => {
        if (task.status === 'Completed') {
          tCompleted++;
          tCounts[shortDate]++;
          
          if (task.refillBy) {
             if (!wStats[task.refillBy]) wStats[task.refillBy] = { completed: 0, total: 0 };
             wStats[task.refillBy].completed++;
             wStats[task.refillBy].total = Math.max(wStats[task.refillBy].total, wStats[task.refillBy].completed);
          }

          if (task.category) {
             cCounts[task.category] = (cCounts[task.category] || 0) + 1;
          }

          const itemKey = `${task.brand}-${task.code}`;
          if (!iCounts[itemKey]) {
             iCounts[itemKey] = { brand: task.brand, code: task.code, count: 0 };
          }
          iCounts[itemKey].count++;
        }
        
        if (task.godown) {
          gCounts[task.godown] = (gCounts[task.godown] || 0) + 1;
        }
      });
    });

    const rate = tItems > 0 ? Math.round((tCompleted / tItems) * 100) : 0;

    const gData = Object.entries(gCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const wData = Object.entries(wStats)
      .map(([name, stats]) => ({ name, completed: stats.completed, total: stats.total }))
      .sort((a, b) => b.completed - a.completed);

    const cData = Object.entries(cCounts)
      .map(([name, value], index) => ({ name, value, color: COLORS[index % COLORS.length] }))
      .sort((a, b) => b.value - a.value);

    const topItm = Object.values(iCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const trData = Object.entries(tCounts)
      .map(([date, count]) => ({ date, completed: count }));

    const pData = [
      { name: 'Completed', value: tCompleted, color: '#10b981' },
      { name: 'Pending', value: tItems - tCompleted, color: '#f43f5e' }
    ];

    return {
      totalItems: tItems,
      totalCompleted: tCompleted,
      completionRate: rate,
      godownData: gData,
      workerData: wData,
      trendData: trData,
      pieData: pData,
      categoryData: cData,
      topItems: topItm
    };
  }, [dailyReports]);

  const maxWorkerTasks = workerData.length > 0 ? workerData[0].completed : 1;

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in pb-8 w-full max-w-full overflow-hidden">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-3 text-slate-500">
            <div className="p-1.5 bg-blue-50 rounded-lg">
              <Box size={16} className="text-blue-600" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Total Items</span>
          </div>
          <span className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{totalItems.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-3 text-slate-500">
            <div className="p-1.5 bg-emerald-50 rounded-lg">
              <Target size={16} className="text-emerald-600" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Completed</span>
          </div>
          <span className="text-3xl md:text-4xl font-black text-emerald-600 tracking-tight">{totalCompleted.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-3 text-slate-500">
            <div className="p-1.5 bg-purple-50 rounded-lg">
              <Activity size={16} className="text-purple-600" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Fill Rate</span>
          </div>
          <span className="text-3xl md:text-4xl font-black text-purple-600 tracking-tight">{completionRate}%</span>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-3 text-slate-500">
            <div className="p-1.5 bg-amber-50 rounded-lg">
              <Users size={16} className="text-amber-600" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Active Staff</span>
          </div>
          <span className="text-3xl md:text-4xl font-black text-amber-600 tracking-tight">{workerData.length}</span>
        </div>
      </div>

      {/* Leaderboard & Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Worker Leaderboard */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 shrink-0">
            <Medal size={20} className="text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Staff Leaderboard</h3>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {workerData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No staff data available</div>
            ) : (
              workerData.map((w, idx) => {
                const progress = Math.round((w.completed / maxWorkerTasks) * 100);
                const efficiency = w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0;
                
                let badgeColor = 'bg-slate-100 text-slate-500';
                let icon = <Star size={12} />;
                if (idx === 0) { badgeColor = 'bg-amber-100 text-amber-600'; icon = <Medal size={14} />; }
                else if (idx === 1) { badgeColor = 'bg-slate-200 text-slate-600'; icon = <Medal size={14} />; }
                else if (idx === 2) { badgeColor = 'bg-orange-100 text-orange-700'; icon = <Medal size={14} />; }

                return (
                  <div key={w.name} className="relative p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 overflow-hidden group hover:bg-slate-50 transition-colors">
                    {/* Background Progress Bar */}
                    <div 
                      className={`absolute top-0 left-0 bottom-0 opacity-10 transition-all duration-1000 ease-out ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-500' : idx === 2 ? 'bg-orange-500' : 'bg-blue-500'}`} 
                      style={{ width: `${progress}%` }} 
                    />
                    
                    <div className="relative flex items-center justify-between z-10">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${badgeColor} shadow-sm group-hover:scale-110 transition-transform`}>
                          {icon}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-800 block leading-tight">{w.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium mt-0.5 inline-block">Efficiency: {efficiency}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-lg font-black text-slate-700">{w.completed.toLocaleString()}</span>
                        <span className="block text-[9px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">Tasks</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Restocked Items */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 shrink-0">
            <ShoppingCart size={20} className="text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Top Restocked Items</h3>
          </div>
          <div className="space-y-2.5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {topItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No item data available</div>
            ) : (
              topItems.map((item, idx) => (
                <div key={`${item.brand}-${item.code}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors shadow-sm">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50/80 text-indigo-700 border border-indigo-100/50 flex items-center justify-center text-[11px] font-bold shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate leading-tight">{item.brand}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">{item.code}</p>
                    </div>
                  </div>
                  <div className="shrink-0 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 border border-emerald-100 shadow-sm ml-2">
                    {item.count}x
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Category Distribution */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
            <Package size={20} className="text-pink-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Category Split</h3>
          </div>
          <div className="h-[340px] md:h-[380px] w-full">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No category data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontSize: 13, fontWeight: '700', padding: '12px' }}
                    itemStyle={{ color: '#1e293b' }}
                  />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12, fontWeight: '600', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Skipped Task Ratio */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
            <Activity size={20} className="text-rose-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Fulfillment Ratio</h3>
          </div>
          <div className="h-[340px] md:h-[380px] w-full">
            {totalItems === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No tasks available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontSize: 13, fontWeight: '700', padding: '12px' }}
                  />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12, fontWeight: '600', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Trend Chart */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
            <TrendingUp size={20} className="text-blue-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Completion Trend</h3>
          </div>
          <div className="h-[340px] md:h-[380px] w-full">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No trend data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontSize: 13, fontWeight: '700', padding: '12px' }}
                  />
                  <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#3b82f6' }} activeDot={{ r: 7, strokeWidth: 0, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Godown Activity Heatmap */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-card">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
            <Box size={20} className="text-purple-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Godown Load</h3>
          </div>
          <div className="h-[340px] md:h-[380px] w-full">
            {godownData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No godown data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={godownData} margin={{ top: 10, right: 10, left: -25, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" dy={15} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontSize: 13, fontWeight: '700', padding: '12px' }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
