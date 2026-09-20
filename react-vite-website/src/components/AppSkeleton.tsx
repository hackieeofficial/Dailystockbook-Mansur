import React from 'react';

export const AppSkeleton: React.FC = () => {
  return (
    <div className="h-[100dvh] w-full flex justify-center bg-zinc-950 font-sans antialiased overflow-hidden">
      <div className="w-full max-w-md md:max-w-none lg:max-w-6xl mx-auto h-full bg-warmCanvas flex flex-col md:flex-row shadow-2xl relative overflow-hidden">
        
        {/* Desktop Sidebar Skeleton */}
        <div className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-200 shrink-0 h-full p-4">
          <div className="h-8 w-32 bg-slate-200 rounded animate-pulse mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 w-full bg-slate-100 rounded animate-pulse"></div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header Skeleton */}
        <div className="h-14 bg-white/95 border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>
            <div className="w-24 h-5 rounded-md bg-slate-200 animate-pulse"></div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>
        </div>

        {/* Content Skeleton */}
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

          {/* Bottom Nav Skeleton (Mobile Only) */}
          <div className="md:hidden h-16 bg-white border-t border-slate-200 flex justify-around items-center px-2 shrink-0 pb-safe">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 w-16">
                <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse"></div>
                <div className="w-10 h-2 rounded-sm bg-slate-200 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
