'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import KioskWrapper from '@/components/kiosk/KioskWrapper';
import CashDrawerCount from '@/components/kiosk/CashDrawerCount';
import ShiftSummary from '@/components/kiosk/ShiftSummary';

// ── Types ────────────────────────────────────────────────────────
interface EmployeeInfo {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  role: string;
}

interface ActiveShift {
  id: string;
  clockInAt: string;
  status: string;
  openingCash: number | null;
  totalSales: number;
  totalRefunds: number;
  totalTips: number;
  transactionCount: number;
  breakMinutes: number;
  isOnBreak: boolean;
  notes: string | null;
}

interface ShiftSummaryData {
  hoursWorked: string;
  totalMinutes: number;
  breakMinutes: number;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  totalTips: number;
  transactionCount: number;
  cashVariance: number | null;
  expectedCash: number | null;
  closingCash: number | null;
}

type ClockStep = 'loading' | 'clock-in' | 'clock-in-cash' | 'active-shift' | 'clock-out-cash' | 'summary';

// ── Component ────────────────────────────────────────────────────
export default function EmployeeClockPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [step, setStep] = useState<ClockStep>('loading');
  const [isOnline, setIsOnline] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [elapsedTime, setElapsedTime] = useState('');
  const [summary, setSummary] = useState<ShiftSummaryData | null>(null);
  const [shiftClockIn, setShiftClockIn] = useState<string>('');  // ISO string of when shift started

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

  // Load employee data and active shift
  useEffect(() => {
    async function loadData() {
      try {
        const shiftRes = await fetch('/api/employee/shift/active', { credentials: 'include' });
        if (shiftRes.status === 401) {
          router.replace('/employee');
          return;
        }
        const shiftData = await shiftRes.json();

        // Fetch employee profile via API (cookie is httpOnly)
        const profileRes = await fetch('/api/employee/profile', { credentials: 'include' });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setEmployee({
            id: profileData.id,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            displayName: profileData.displayName,
            role: profileData.role,
          });
        }

        if (shiftData.shift) {
          setActiveShift(shiftData.shift);
          setShiftClockIn(shiftData.shift.clockInAt);
          setStep('active-shift');
        } else {
          setStep('clock-in');
        }
      } catch {
        router.replace('/employee');
      }
    }
    loadData();
  }, [router]);

  // Update elapsed time
  useEffect(() => {
    if (!activeShift?.clockInAt) return;
    const updateElapsed = () => {
      const start = new Date(activeShift.clockInAt).getTime();
      const diff = Date.now() - start;
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
    router.push('/employee');
  }, [router]);

  // ── Clock In ──────────────────────────────────────────────────
  const handleClockIn = useCallback(async (openingCash?: number) => {
    setIsProcessing(true);
    setError('');
    try {
      const res = await fetch('/api/employee/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          openingCash,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.title || 'Failed to clock in.');
        return;
      }
      // Refresh shift data
      const shiftRes = await fetch('/api/employee/shift/active', { credentials: 'include' });
      const shiftData = await shiftRes.json();
      setActiveShift(shiftData.shift);
      if (shiftData.shift?.clockInAt) {
        setShiftClockIn(shiftData.shift.clockInAt);
      }
      setStep('active-shift');
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // ── Clock Out ─────────────────────────────────────────────────
  const handleClockOut = useCallback(async (closingCash?: number) => {
    if (!activeShift) return;
    setIsProcessing(true);
    setError('');
    try {
      const res = await fetch('/api/employee/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shiftId: activeShift.id,
          closingCash,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.title || 'Failed to clock out.');
        return;
      }
      setSummary(data.summary);
      setActiveShift(null);
      setStep('summary');
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [activeShift]);

  const formatCurrency = (amount: number) => {
    return `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // ── Render: Loading ───────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <KioskWrapper
      currentEmployee={employee}
      isOnline={isOnline}
      onLock={handleLock}
    >
      <div className="p-4 sm:p-6 max-w-lg mx-auto pb-24">
        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* ── Clock In ──────────────────────────────────────────── */}
        {step === 'clock-in' && (
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Ready to Start?
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Clock in to begin your shift.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleClockIn()}
                disabled={isProcessing}
                className="w-full px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg transition-colors disabled:opacity-50 touch-manipulation"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Clocking In...</span>
                  </div>
                ) : (
                  'Clock In'
                )}
              </button>

              <button
                onClick={() => setStep('clock-in-cash')}
                disabled={isProcessing}
                className="w-full px-6 py-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium transition-colors hover:border-emerald-500 disabled:opacity-50 touch-manipulation"
              >
                Clock In with Cash Count
              </button>
            </div>
          </div>
        )}

        {/* ── Clock In with Cash Count ──────────────────────────── */}
        {step === 'clock-in-cash' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setStep('clock-in')}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Opening Cash Count
              </h2>
            </div>
            <CashDrawerCount
              title="Opening Cash Count"
              expectedAmount={null}
              onSubmit={(data) => handleClockIn(data.amount)}
              onCancel={() => setStep('clock-in')}
              isSubmitting={isProcessing}
            />
          </div>
        )}

        {/* ── Active Shift ──────────────────────────────────────── */}
        {step === 'active-shift' && activeShift && (
          <div>
            {/* Shift Timer */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {activeShift.isOnBreak ? 'On Break' : 'Shift Active'}
                </span>
              </div>
              <p className="text-5xl font-mono font-bold text-gray-900 dark:text-white">
                {elapsedTime}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Started at {new Date(activeShift.clockInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
            </div>

            {/* Shift Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Sales</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(activeShift.totalSales)}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {activeShift.transactionCount}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Tips</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(activeShift.totalTips)}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Breaks</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {activeShift.breakMinutes}m
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => setStep('clock-out-cash')}
                disabled={isProcessing}
                className="w-full px-6 py-4 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-lg transition-colors disabled:opacity-50 touch-manipulation"
              >
                Clock Out
              </button>

              <button
                onClick={() => handleClockOut()}
                disabled={isProcessing}
                className="w-full px-6 py-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium transition-colors hover:border-red-500 disabled:opacity-50 touch-manipulation"
              >
                {isProcessing ? 'Processing...' : 'Quick Clock Out (No Cash Count)'}
              </button>
            </div>
          </div>
        )}

        {/* ── Clock Out with Cash Count ─────────────────────────── */}
        {step === 'clock-out-cash' && activeShift && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setStep('active-shift')}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Closing Cash Count
              </h2>
            </div>
            <CashDrawerCount
              title="Closing Cash Count"
              expectedAmount={
                activeShift.openingCash !== null
                  ? activeShift.openingCash + activeShift.totalSales - activeShift.totalRefunds
                  : null
              }
              onSubmit={(data) => handleClockOut(data.amount)}
              onCancel={() => setStep('active-shift')}
              isSubmitting={isProcessing}
            />
          </div>
        )}

        {/* ── Shift Summary ─────────────────────────────────────── */}
        {step === 'summary' && summary && (
          <div>
            <ShiftSummary
              employeeName={employee?.displayName || (employee ? `${employee.firstName} ${employee.lastName}` : 'Employee')}
              shiftDate={new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              clockIn={shiftClockIn ? new Date(shiftClockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}
              clockOut={new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              summary={{
                hoursWorked: summary.hoursWorked,
                totalMinutes: summary.totalMinutes,
                breakMinutes: summary.breakMinutes,
                totalSales: summary.totalSales,
                totalRefunds: summary.totalRefunds,
                totalVoids: summary.totalVoids,
                totalTips: summary.totalTips,
                transactionCount: summary.transactionCount,
                cashVariance: summary.cashVariance,
                expectedCash: summary.expectedCash,
                closingCash: summary.closingCash,
              }}
              onClose={() => router.push('/employee/home')}
            />
          </div>
        )}

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex justify-around">
          <button
            onClick={() => router.push('/employee/home')}
            className="flex flex-col items-center gap-1 px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 px-3 py-1 text-emerald-600 dark:text-emerald-400"
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
