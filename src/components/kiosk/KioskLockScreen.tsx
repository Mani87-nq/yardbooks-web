'use client';

import React, { useState, useCallback, useEffect } from 'react';

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

interface KioskLockScreenProps {
  employees: KioskEmployee[];
  companyName?: string;
  onAuthenticate: (employeeId: string, pin: string) => Promise<{ success: boolean; error?: string; retryAfter?: number }>;
  isOnline?: boolean;
  isLoading?: boolean;
}

type ConnectionStatus = 'online' | 'slow' | 'offline';

// ── Component ────────────────────────────────────────────────────
export default function KioskLockScreen({
  employees,
  companyName = 'YaadBooks',
  onAuthenticate,
  isOnline = true,
  isLoading = false,
}: KioskLockScreenProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<KioskEmployee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [authenticating, setAuthenticating] = useState(false);

  const connectionStatus = (isOnline ? 'online' : 'offline') as ConnectionStatus;

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleEmployeeSelect = useCallback((emp: KioskEmployee) => {
    setSelectedEmployee(emp);
    setPin('');
    setError('');
  }, []);

  const handleBack = useCallback(() => {
    setSelectedEmployee(null);
    setPin('');
    setError('');
  }, []);

  const handlePinDigit = useCallback((digit: string) => {
    if (lockoutSeconds > 0) return;
    setPin((prev) => {
      if (prev.length >= 6) return prev;
      return prev + digit;
    });
    setError('');
  }, [lockoutSeconds]);

  const handlePinDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handlePinClear = useCallback(() => {
    setPin('');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedEmployee || pin.length < 4 || authenticating) return;

    setAuthenticating(true);
    setError('');

    try {
      const result = await onAuthenticate(selectedEmployee.id, pin);

      if (!result.success) {
        setError(result.error || 'Invalid PIN');
        setPin('');

        if (result.retryAfter) {
          setLockoutSeconds(result.retryAfter);
        }
      }
    } catch {
      setError('Authentication failed. Please try again.');
      setPin('');
    } finally {
      setAuthenticating(false);
    }
  }, [selectedEmployee, pin, authenticating, onAuthenticate]);

  // Auto-submit when PIN length reaches 4
  useEffect(() => {
    if (pin.length === 4 && selectedEmployee && !authenticating) {
      handleSubmit();
    }
  }, [pin, selectedEmployee, authenticating, handleSubmit]);

  // ── Avatar Grid Screen ─────────────────────────────────────────
  if (!selectedEmployee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 select-none">
        {/* Status indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              connectionStatus === 'online'
                ? 'bg-green-500'
                : connectionStatus === 'slow'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {connectionStatus}
          </span>
        </div>

        {/* Company name */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {companyName}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Tap your name to sign in
          </p>
        </div>

        {/* Employee grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-2xl w-full">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleEmployeeSelect(emp)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors active:scale-95 touch-manipulation"
              >
                {/* Avatar */}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: emp.avatarColor }}
                >
                  {(emp.displayName || emp.firstName).charAt(0).toUpperCase()}
                  {emp.lastName.charAt(0).toUpperCase()}
                </div>
                {/* Name */}
                <span className="text-sm font-medium text-gray-900 dark:text-white text-center truncate w-full">
                  {emp.displayName || `${emp.firstName} ${emp.lastName}`}
                </span>
                {/* Clocked in indicator */}
                {emp.isClockedIn && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Clocked In
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {employees.length === 0 && !isLoading && (
          <p className="text-gray-500 dark:text-gray-400 py-20 text-center">
            No employees configured. Add employees from the dashboard.
          </p>
        )}
      </div>
    );
  }

  // ── PIN Entry Screen ───────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 select-none">
      {/* Status indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            connectionStatus === 'online'
              ? 'bg-green-500'
              : connectionStatus === 'slow'
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
          {connectionStatus}
        </span>
      </div>

      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors touch-manipulation"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
      </button>

      {/* Selected employee */}
      <div className="mb-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3"
          style={{ backgroundColor: selectedEmployee.avatarColor }}
        >
          {(selectedEmployee.displayName || selectedEmployee.firstName).charAt(0).toUpperCase()}
          {selectedEmployee.lastName.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {selectedEmployee.displayName || `${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Enter your PIN
        </p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-3 mb-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < pin.length
                ? 'bg-blue-500 border-blue-500 scale-110'
                : i < 4
                ? 'border-gray-300 dark:border-gray-600'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 max-w-xs text-center">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          {lockoutSeconds > 0 && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">
              Try again in {lockoutSeconds}s
            </p>
          )}
        </div>
      )}

      {/* Loading spinner */}
      {authenticating && (
        <div className="mb-4">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 max-w-xs w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            onClick={() => handlePinDigit(digit)}
            disabled={lockoutSeconds > 0 || authenticating}
            className="w-[72px] h-[72px] mx-auto rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-2xl font-bold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {digit}
          </button>
        ))}

        {/* Bottom row: Clear, 0, Delete */}
        <button
          onClick={handlePinClear}
          disabled={lockoutSeconds > 0 || authenticating}
          className="w-[72px] h-[72px] mx-auto rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 transition-colors disabled:opacity-50 touch-manipulation"
        >
          Clear
        </button>
        <button
          onClick={() => handlePinDigit('0')}
          disabled={lockoutSeconds > 0 || authenticating}
          className="w-[72px] h-[72px] mx-auto rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-2xl font-bold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          0
        </button>
        <button
          onClick={handlePinDelete}
          disabled={lockoutSeconds > 0 || authenticating}
          className="w-[72px] h-[72px] mx-auto rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 transition-colors disabled:opacity-50 touch-manipulation flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
          </svg>
        </button>
      </div>

      {/* Manual submit for 5-6 digit PINs */}
      {pin.length >= 5 && (
        <button
          onClick={handleSubmit}
          disabled={authenticating}
          className="mt-4 px-8 py-3 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold text-lg transition-colors disabled:opacity-50 touch-manipulation"
        >
          Sign In
        </button>
      )}
    </div>
  );
}
