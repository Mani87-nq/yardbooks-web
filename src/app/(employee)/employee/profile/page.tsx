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

interface Stats {
  totalShifts: number;
  hoursWorked: number;
  totalSales: number;
  totalRefunds: number;
  totalTips: number;
  totalTransactions: number;
  avgTicket: number;
  salesPerHour: number;
  avgShiftHours: number;
}

interface ScheduledShift {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string | null;
  notes: string | null;
}

type StatsPeriod = 7 | 14 | 30 | 90;

// ── Component ────────────────────────────────────────────────────
export default function EmployeeProfilePage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [schedule, setSchedule] = useState<ScheduledShift[]>([]);
  const [period, setPeriod] = useState<StatsPeriod>(30);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  // Fetch employee profile via API (cookie is httpOnly, can't read client-side)
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/employee/profile', { credentials: 'include' });
        if (res.status === 401) {
          router.replace('/employee');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setEmployee({
            id: data.id,
            firstName: data.firstName,
            lastName: data.lastName,
            displayName: data.displayName,
            role: data.role,
            avatarColor: data.avatarColor,
          });
        }
      } catch {
        router.replace('/employee');
      }
    }
    fetchProfile();
  }, [router]);

  // Fetch stats when period changes
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/employee/stats?period=${period}`, { credentials: 'include' });
        if (res.status === 401) {
          router.replace('/employee');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
        }
      } catch {
        // Silently fail — stats not critical
      }
    }
    fetchStats();
  }, [period, router]);

  // Fetch schedule
  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await fetch('/api/employee/schedule?weeks=2', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSchedule(data.data || []);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    }
    fetchSchedule();
  }, []);

  const handleLock = useCallback(() => {
    router.push('/employee');
  }, [router]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await fetch('/api/employee/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Proceed even if logout API fails
    }
    router.replace('/employee');
  }, [router]);

  const formatCurrency = (amount: number) => {
    return `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    // timeStr could be "09:00" or ISO date — handle both
    if (timeStr.includes('T')) {
      return new Date(timeStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const roleDisplay = employee?.role?.replace('POS_', '').replace('_', ' ') || 'Staff';

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
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ backgroundColor: employee?.avatarColor || '#3B82F6' }}
          >
            {(employee?.displayName || employee?.firstName || 'E').charAt(0).toUpperCase()}
            {(employee?.lastName || 'P').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {employee?.displayName || `${employee?.firstName} ${employee?.lastName}`}
            </h1>
            <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              {roleDisplay}
            </span>
          </div>
        </div>

        {/* Stats Period Selector */}
        <div className="flex gap-2 mb-4">
          {([7, 14, 30, 90] as StatsPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                period === p
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-emerald-500'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Performance — Last {period} Days
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Hours</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.hoursWorked.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Shifts</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.totalShifts}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Shift</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.avgShiftHours.toFixed(1)}h</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sales</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalSales)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.totalTransactions}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Ticket</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats.avgTicket)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tips</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalTips)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sales/Hour</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats.salesPerHour)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Refunds</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalRefunds)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Schedule */}
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Upcoming Schedule
          </h2>
          {schedule.length > 0 ? (
            <div className="space-y-2">
              {schedule.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(shift.shiftDate)}
                    </p>
                    {shift.role && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{shift.role}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                    </p>
                    {shift.notes && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{shift.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No upcoming shifts scheduled.
            </p>
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium transition-colors hover:border-red-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 touch-manipulation"
        >
          {isSigningOut ? 'Signing Out...' : 'Sign Out'}
        </button>

      </div>
    </KioskWrapper>
  );
}
