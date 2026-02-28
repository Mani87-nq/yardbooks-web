'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import KioskBottomNav from '@/components/kiosk/KioskBottomNav';

// ── Types ────────────────────────────────────────────────────────
interface KioskEmployee {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  role: string;
}

interface KioskWrapperProps {
  children: React.ReactNode;
  currentEmployee: KioskEmployee | null;
  isOnline?: boolean;
  inactivityTimeoutMinutes?: number;
  onLock: () => void;
  onToggleFullscreen?: () => void;
  terminalNumber?: number | null;
  companyName?: string;
}

// ── Component ────────────────────────────────────────────────────
export default function KioskWrapper({
  children,
  currentEmployee,
  isOnline = true,
  inactivityTimeoutMinutes = 2,
  onLock,
  onToggleFullscreen,
  terminalNumber,
  companyName,
}: KioskWrapperProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset inactivity timer on user interaction
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    if (inactivityTimeoutMinutes > 0 && currentEmployee) {
      inactivityTimerRef.current = setTimeout(() => {
        onLock();
      }, inactivityTimeoutMinutes * 60 * 1000);
    }
  }, [inactivityTimeoutMinutes, currentEmployee, onLock]);

  // Set up global event listeners for activity detection
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];

    const handleActivity = () => {
      resetInactivityTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetInactivityTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetInactivityTimer]);

  // Prevent navigation away (kiosk mode)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    // Prevent back/forward navigation
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const employeeDisplayName = currentEmployee
    ? currentEmployee.displayName || `${currentEmployee.firstName} ${currentEmployee.lastName}`
    : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden select-none">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm shrink-0">
        {/* Left: Online status + date/time */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(currentTime)}
          </span>
          <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">
            {formatTime(currentTime)}
          </span>
          {companyName && (
            <>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                {companyName}
              </span>
            </>
          )}
        </div>

        {/* Center: Current employee */}
        {employeeDisplayName && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {employeeDisplayName}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
              {currentEmployee?.role.replace('POS_', '').replace('_', ' ')}
            </span>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {terminalNumber != null && (
            <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono font-medium">
              Terminal {terminalNumber}
            </span>
          )}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
              title="Toggle fullscreen"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          )}
          <button
            onClick={onLock}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors touch-manipulation"
            title="Lock screen"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-sm font-medium hidden sm:inline">Lock</span>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto pb-16">
        {children}
      </div>

      {/* Bottom navigation */}
      <KioskBottomNav />
    </div>
  );
}
