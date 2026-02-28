'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import KioskLockScreen from '@/components/kiosk/KioskLockScreen';

// ── Types ────────────────────────────────────────────────────────
interface KioskEmployee {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarColor: string;
  role: string;
  isClockedIn: boolean;
}

// ── Login Steps ──────────────────────────────────────────────────
type LoginStep = 'company-code' | 'employee-select';

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('company-code');
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [employees, setEmployees] = useState<KioskEmployee[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

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

  // Check if already authenticated (has terminal cookie)
  useEffect(() => {
    fetch('/api/employee/shift/active', { credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          // Already authenticated — redirect to home
          router.replace('/employee/home');
        }
      })
      .catch(() => {
        // Not authenticated or network error — stay on login
      });
  }, [router]);

  // ── Step 1: Enter Company Code ──────────────────────────────
  const handleCompanyCodeSubmit = useCallback(async () => {
    const code = companyCode.trim().toUpperCase();
    if (code.length < 1) {
      setError('Please enter your company code.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/employee/auth/employees?code=${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || data.title || 'Invalid company code.');
        setIsLoading(false);
        return;
      }

      setCompanyName(data.company?.name || 'YaadBooks');
      setEmployees(data.data || []);
      setStep('employee-select');
    } catch {
      setError('Unable to connect. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  }, [companyCode]);

  // ── Step 2: Authenticate with PIN (via KioskLockScreen) ─────
  const handleAuthenticate = useCallback(
    async (employeeId: string, pin: string) => {
      try {
        const res = await fetch('/api/employee/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            companyCode: companyCode.trim().toUpperCase(),
            employeeProfileId: employeeId,
            pin,
          }),
        });

        const data = await res.json();

        if (res.ok && data.authenticated) {
          // Success — redirect to home
          router.push('/employee/home');
          return { success: true };
        }

        // Handle lockout
        if (res.status === 429) {
          return {
            success: false,
            error: data.detail || 'Too many attempts. Please wait.',
            retryAfter: data.retryAfter,
          };
        }

        return {
          success: false,
          error: data.detail || 'Incorrect PIN.',
        };
      } catch {
        return {
          success: false,
          error: 'Unable to connect. Please try again.',
        };
      }
    },
    [companyCode, router]
  );

  // ── Handle back to company code step ────────────────────────
  const handleBackToCompanyCode = useCallback(() => {
    setStep('company-code');
    setEmployees([]);
    setCompanyName('');
    setError('');
  }, []);

  // ── Render: Company Code Entry ──────────────────────────────
  if (step === 'company-code') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 select-none">
        {/* Online indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isOnline ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">YB</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Employee Portal
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Enter your company code to get started
          </p>
        </div>

        {/* Company code input */}
        <div className="w-full max-w-sm">
          <label htmlFor="company-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Company Code
          </label>
          <input
            id="company-code"
            type="text"
            value={companyCode}
            onChange={(e) => {
              setCompanyCode(e.target.value.toUpperCase());
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCompanyCodeSubmit();
            }}
            placeholder="e.g. YB4K9M"
            maxLength={10}
            autoFocus
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-wider rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
          />

          {/* Error */}
          {error && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-center">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleCompanyCodeSubmit}
            disabled={isLoading || !companyCode.trim()}
            className="w-full mt-4 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </div>
            ) : (
              'Continue'
            )}
          </button>
        </div>

        {/* Help text */}
        <p className="mt-8 text-xs text-gray-400 dark:text-gray-500 text-center max-w-sm">
          Your company code is provided by your manager. It looks like a
          6-character code (e.g. YB4K9M).
        </p>
      </div>
    );
  }

  // ── Render: Employee Selection + PIN ────────────────────────
  return (
    <div className="relative min-h-screen">
      {/* Back button overlay */}
      <button
        onClick={handleBackToCompanyCode}
        className="absolute top-4 left-4 z-50 p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors touch-manipulation"
        title="Change company"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
      </button>

      <KioskLockScreen
        employees={employees}
        companyName={companyName}
        onAuthenticate={handleAuthenticate}
        isOnline={isOnline}
        isLoading={isLoading}
      />
    </div>
  );
}
