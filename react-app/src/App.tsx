import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuthStore } from './store/useAuthStore';
import { useSyncStore } from './store/useSyncStore';
import { refreshSession } from './lib/auth';
import { initCloudRealtime } from './lib/syncEngine';
import { logger } from './lib/logger';
import { usePreferencesStore } from './store/usePreferencesStore';

import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppSkeleton } from './components/AppSkeleton';

const CalendarView = lazy(() => import('./features/CalendarView').then(m => ({ default: m.CalendarView })));
const WorkspaceView = lazy(() => import('./features/WorkspaceView').then(m => ({ default: m.WorkspaceView })));
const UploadView = lazy(() => import('./features/UploadView').then(m => ({ default: m.UploadView })));
const ReportsView = lazy(() => import('./features/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = lazy(() => import('./features/SettingsView').then(m => ({ default: m.SettingsView })));
const ZeroStockView = lazy(() => import('./features/ZeroStockView').then(m => ({ default: m.ZeroStockView })));
const LoginView = lazy(() => import('./features/LoginView').then(m => ({ default: m.LoginView })));

const LayoutWrapper: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
};

export const App: React.FC = () => {
  const { user, isLoading } = useAuthStore();
  const { getPreferences, preferencesByUser } = usePreferencesStore();

  useEffect(() => {
    if (user) {
      const prefs = getPreferences(user.uid);
      const root = document.documentElement;
      
      // Mobile Typography
      // Mobile Typography
      root.style.setProperty('--user-font-title-mobile', `${prefs.mobileTitleSize}px`);
      root.style.setProperty('--user-font-category-mobile', `${prefs.mobileCategorySize}px`);
      root.style.setProperty('--user-font-qty-mobile', `${prefs.mobileQtySize}px`);
      root.style.setProperty('--user-font-qty-label-mobile', `${prefs.mobileQtyLabelSize}px`);
      root.style.setProperty('--user-font-price-primary-mobile', `${prefs.mobilePricePrimarySize}px`);
      root.style.setProperty('--user-font-price-secondary-mobile', `${prefs.mobilePriceSecondarySize}px`);
      root.style.setProperty('--user-font-badge-mobile', `${prefs.mobileBadgeSize}px`);
      root.style.setProperty('--user-font-meta-mobile', `${prefs.mobileMetaSize}px`);
      
      // Desktop Typography
      root.style.setProperty('--user-font-title-desktop', `${prefs.desktopTitleSize}px`);
      root.style.setProperty('--user-font-category-desktop', `${prefs.desktopCategorySize}px`);
      root.style.setProperty('--user-font-qty-desktop', `${prefs.desktopQtySize}px`);
      root.style.setProperty('--user-font-qty-label-desktop', `${prefs.desktopQtyLabelSize}px`);
      root.style.setProperty('--user-font-price-primary-desktop', `${prefs.desktopPricePrimarySize}px`);
      root.style.setProperty('--user-font-price-secondary-desktop', `${prefs.desktopPriceSecondarySize}px`);
      root.style.setProperty('--user-font-badge-desktop', `${prefs.desktopBadgeSize}px`);
      root.style.setProperty('--user-font-meta-desktop', `${prefs.desktopMetaSize}px`);

      // Theme Colors
      root.style.setProperty('--theme-accent', `var(--color-${prefs.themeAccent})`);

      // Body Modifiers
      document.body.classList.toggle('high-contrast', prefs.highContrastMode);
      document.body.classList.toggle('reduce-motion', prefs.reduceMotion);
      document.body.classList.toggle('grayscale-mode', prefs.grayscaleMode);
      
      document.body.classList.toggle('hide-zero-balances', prefs.hideZeroBalances);
      document.body.classList.toggle('hide-category-labels', !prefs.showCategoryLabels);
      document.body.classList.toggle('hide-currency', !prefs.showCurrencySymbol);
      
      // Font Family
      document.body.setAttribute('data-font', prefs.fontFamily);
      // UI Density
      document.body.setAttribute('data-density', prefs.uiDensity);
      // Qty Alignment
      document.body.setAttribute('data-qty-align', prefs.qtyAlignment);
    }
  }, [user, getPreferences, user?.uid, preferencesByUser]);

  useEffect(() => {
    refreshSession();
  }, []);

  useEffect(() => {
    if (user) {
      initCloudRealtime();
      import('./store/usePreferencesStore').then(m => m.initPrefsRealtime(user.uid));
    }
  }, [user]);

  useEffect(() => {
    const handleOnline = () => {
      logger.info('network', 'statusChange', 'Browser came online');
      useSyncStore.getState().setIsCloudOnline(true);
      refreshSession();
    };
    const handleOffline = () => {
      logger.warn('network', 'statusChange', 'Browser went offline');
      useSyncStore.getState().setIsCloudOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isLoading) {
    return <AppSkeleton />;
  }

  return (
    <TooltipProvider>
      <Suspense fallback={<AppSkeleton />}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginView />} />
            
            <Route element={<LayoutWrapper />}>
              <Route path="/" element={<CalendarView />} />
              <Route path="/workspace/:dateStr" element={<WorkspaceView />} />
              <Route path="/zero-stock" element={<ZeroStockView />} />
              <Route path="/upload" element={<UploadView />} />
              <Route path="/reports" element={<ReportsView />} />
              <Route path="/settings" element={<SettingsView />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Suspense>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  );
};

export default App;
