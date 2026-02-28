'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import KioskWrapper from '@/components/kiosk/KioskWrapper';

// ── Types ────────────────────────────────────────────────────────
interface EmployeeInfo {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  role: string;
  avatarColor: string;
}

interface ActiveShift {
  id: string;
  clockInAt: string;
  status: string;
  totalSales: number;
  totalTips: number;
  transactionCount: number;
  isOnBreak: boolean;
}

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
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('');

  // Track online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load employee data via profile API (cookie is httpOnly, can't read client-side)
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch employee profile (validates terminal auth)
        const profileRes = await fetch('/api/employee/profile', { credentials: 'include' });
        if (profileRes.status === 401) {
          router.replace('/employee');
          return;
        }
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setEmployee({
            id: profileData.id,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            displayName: profileData.displayName,
            role: profileData.role,
            avatarColor: profileData.avatarColor,
          });
        }

        // Fetch active shift
        const shiftRes = await fetch('/api/employee/shift/active', { credentials: 'include' });
        if (shiftRes.ok) {
          const shiftData = await shiftRes.json();
          setActiveShift(shiftData.shift);
        }

        // Fetch 7-day stats
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
        // Auth failed or network error
        router.replace('/employee');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

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
          /* No active shift — show clock in prompt */
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

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
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

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex justify-around">
          <button
            className="flex flex-col items-center gap-1 px-3 py-1 text-emerald-600 dark:text-emerald-400"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => router.push('/employee/clock')}
            className="flex flex-col items-center gap-1 px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">Clock</span>
          </button>
          <button
            onClick={() => router.push('/employee/profile')}
            className="flex flex-col items-center gap-1 px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="text-xs font-medium">Profile</span>
          </button>
        </nav>
      </div>
    </KioskWrapper>
  );
}
