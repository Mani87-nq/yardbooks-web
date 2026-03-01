'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import KioskWrapper from '@/components/kiosk/KioskWrapper';
import { useKioskStore } from '@/store/kioskStore';

// Lazy-loaded kiosk POS widgets (only loaded when retail module is active)
const NewSaleWidget = lazy(() => import('@/components/kiosk/pos/NewSaleWidget'));
const RecentOrdersWidget = lazy(() => import('@/components/kiosk/pos/RecentOrdersWidget'));

// ── Types ────────────────────────────────────────────────────────
interface ShiftStats {
  hoursWorked: number;
  totalSales: number;
  totalTips: number;
  totalTransactions: number;
  avgTicket: number;
}

// ── Component ────────────────────────────────────────────────────
export default function EmployeeHomePage() {
  const router = useRouter();

  // Kiosk store state
  const {
    currentEmployee,
    activeShift,
    activeModules,
    companyName,
    terminalNumber,
    isOnline,
    isContextLoaded,
    loadKioskContext,
    setOnline,
  } = useKioskStore();

  // Page-specific local state
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('');

  // Track online status and sync with kiosk store
  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  // Load kiosk context if not already loaded
  useEffect(() => {
    if (!isContextLoaded) {
      loadKioskContext();
    }
  }, [isContextLoaded, loadKioskContext]);

  // Fetch page-specific stats (not in kiosk store)
  useEffect(() => {
    if (!isContextLoaded) return;

    // If no employee after context loads, redirect to login
    if (!currentEmployee) {
      router.replace('/employee');
      return;
    }

    async function loadStats() {
      try {
        const statsRes = await fetch('/api/employee/stats?period=7', { credentials: 'include' });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats({
            hoursWorked: statsData.stats.hoursWorked,
            totalSales: statsData.stats.totalSales,
            totalTips: statsData.stats.totalTips,
            totalTransactions: statsData.stats.totalTransactions,
            avgTicket: statsData.stats.avgTicket,
          });
        }
      } catch {
        // Stats fetch failed — non-critical, continue without them
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
  }, [isContextLoaded, currentEmployee, router]);

  // Update elapsed shift time every second
  useEffect(() => {
    if (!activeShift?.clockInAt) return;

    const updateElapsed = () => {
      const start = new Date(activeShift.clockInAt).getTime();
      const now = Date.now();
      const diff = now - start;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [activeShift?.clockInAt]);

  const handleLock = useCallback(() => {
    // On lock, redirect to login for PIN re-entry
    router.push('/employee');
  }, [router]);

  const formatCurrency = (amount: number) => {
    return `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Module helpers
  const hasModule = (moduleId: string) => activeModules.includes(moduleId);
  const hasPOS = hasModule('retail') || hasModule('restaurant');
  const hasSalon = hasModule('salon');
  const hasRestaurant = hasModule('restaurant');

  if (!isContextLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const employee = currentEmployee;
  const roleDisplay = employee?.role?.replace('POS_', '').replace('_', ' ') || 'Staff';
  const isManager = employee?.role === 'SHIFT_MANAGER' || employee?.role === 'STORE_MANAGER';

  return (
    <KioskWrapper
      currentEmployee={employee ? {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        displayName: employee.displayName,
        role: employee.role,
      } : null}
      isOnline={isOnline}
      onLock={handleLock}
      companyName={companyName}
      terminalNumber={terminalNumber}
    >
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hi, {employee?.displayName || employee?.firstName || 'there'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {roleDisplay} &bull; {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Active Shift Banner */}
        {activeShift ? (
          <div className="mb-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    {activeShift.isOnBreak ? 'On Break' : 'Clocked In'}
                  </span>
                </div>
                <p className="text-3xl font-mono font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                  {elapsedTime}
                </p>
              </div>
              <button
                onClick={() => router.push('/employee/clock')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors touch-manipulation"
              >
                View Shift
              </button>
            </div>
            {activeShift.transactionCount > 0 && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700">
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Sales</p>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                    {formatCurrency(activeShift.totalSales)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Transactions</p>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                    {activeShift.transactionCount}
                  </p>
                </div>
                {activeShift.totalTips > 0 && (
                  <div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Tips</p>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                      {formatCurrency(activeShift.totalTips)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* No active shift -- show clock in prompt */
          <button
            onClick={() => router.push('/employee/clock')}
            className="w-full mb-6 p-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-center transition-colors touch-manipulation"
          >
            <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xl font-bold block">Clock In</span>
            <span className="text-emerald-200 text-sm">Start your shift</span>
          </button>
        )}

        {/* Quick Actions — module-aware */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Always: Clock In/Out */}
          <button
            onClick={() => router.push('/employee/clock')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 transition-colors touch-manipulation"
          >
            <svg className="w-8 h-8 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {activeShift ? 'Clock Out' : 'Clock In'}
            </span>
          </button>

          {/* POS / Retail / Restaurant: New Sale */}
          {hasPOS && (
            <button
              onClick={() => router.push('/employee/pos')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 transition-colors touch-manipulation"
            >
              <svg className="w-8 h-8 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Sale</span>
            </button>
          )}

          {/* Salon: Appointments */}
          {hasSalon && (
            <button
              onClick={() => router.push('/employee/salon')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 transition-colors touch-manipulation"
            >
              <svg className="w-8 h-8 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Appointments</span>
            </button>
          )}

          {/* Restaurant: Tables */}
          {hasRestaurant && (
            <button
              onClick={() => router.push('/employee/restaurant/tables')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 transition-colors touch-manipulation"
            >
              <svg className="w-8 h-8 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tables</span>
            </button>
          )}

          {/* Always: My Stats */}
          <button
            onClick={() => router.push('/employee/profile')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 transition-colors touch-manipulation"
          >
            <svg className="w-8 h-8 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">My Stats</span>
          </button>
        </div>

        {/* Weekly Stats Summary */}
        {stats && (
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Last 7 Days
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Hours</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {stats.hoursWorked.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sales</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(stats.totalSales)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {stats.totalTransactions}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tips</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(stats.totalTips)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* POS Quick Actions (retail module active) */}
        {hasPOS && (
          <div className="mt-6 space-y-3">
            <Suspense fallback={<div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />}>
              <NewSaleWidget />
            </Suspense>
            <Suspense fallback={<div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />}>
              <RecentOrdersWidget />
            </Suspense>
          </div>
        )}

        {/* Module Summary Widgets */}
        <div className="mt-6 space-y-3">
          {/* POS / Restaurant: Today's Sales (only when shift is active) */}
          {hasPOS && activeShift && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wider">
                  Today&apos;s Sales
                </p>
                <p className="text-xl font-bold text-blue-800 dark:text-blue-200 mt-1">
                  {formatCurrency(activeShift.totalSales)}
                </p>
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                {activeShift.transactionCount} txn{activeShift.transactionCount !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Salon module card */}
          {hasSalon && (
            <button
              onClick={() => router.push('/employee/salon')}
              className="w-full rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 flex items-center justify-between text-left transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/30 touch-manipulation"
            >
              <div>
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                  Salon
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                  Appointments &amp; Walk-ins
                </p>
              </div>
              <svg className="w-5 h-5 text-purple-400 dark:text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}

          {/* Restaurant module card */}
          {hasRestaurant && (
            <button
              onClick={() => router.push('/employee/restaurant/tables')}
              className="w-full rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 flex items-center justify-between text-left transition-colors hover:bg-orange-100 dark:hover:bg-orange-900/30 touch-manipulation"
            >
              <div>
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                  Restaurant
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                  Tables &amp; Kitchen
                </p>
              </div>
              <svg className="w-5 h-5 text-orange-400 dark:text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </div>

        {/* Manager Section */}
        {isManager && (
          <div className="mt-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-2">
              Manager Actions
            </h2>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              As a {roleDisplay.toLowerCase()}, you can approve voids, refunds, and discounts
              when prompted by other employees.
            </p>
          </div>
        )}
      </div>
    </KioskWrapper>
  );
}
