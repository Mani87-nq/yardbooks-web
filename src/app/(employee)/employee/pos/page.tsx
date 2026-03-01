'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import KioskWrapper from '@/components/kiosk/KioskWrapper';
import { useKioskStore } from '@/store/kioskStore';
import { useKioskPosStore, type KioskPosSession } from '@/store/kioskPosStore';
import OpenSessionScreen from '@/components/kiosk/pos/OpenSessionScreen';
import CloseSessionScreen from '@/components/kiosk/pos/CloseSessionScreen';
import RegisterScreen from '@/components/kiosk/pos/RegisterScreen';

// ── Types ────────────────────────────────────────────────────────
type PosView = 'loading' | 'no-module' | 'open-session' | 'register' | 'close-session';

// ── Component ────────────────────────────────────────────────────
export default function KioskPosPage() {
  const router = useRouter();

  // Kiosk store state
  const {
    currentEmployee,
    activeModules,
    companyName,
    terminalNumber,
    terminalId,
    isOnline,
    isContextLoaded,
    loadKioskContext,
    setOnline,
  } = useKioskStore();

  // POS store state
  const {
    currentSession,
    setCurrentSession,
    setPosSettings,
    resetPosState,
  } = useKioskPosStore();

  // Local state
  const [view, setView] = useState<PosView>('loading');
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  // ── Online/offline tracking ───────────────────────────────────
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

  // ── Load kiosk context on mount ───────────────────────────────
  useEffect(() => {
    if (!isContextLoaded) {
      loadKioskContext();
    }
  }, [isContextLoaded, loadKioskContext]);

  // ── Redirect if not logged in ─────────────────────────────────
  useEffect(() => {
    if (isContextLoaded && !currentEmployee) {
      router.replace('/employee');
    }
  }, [isContextLoaded, currentEmployee, router]);

  // ── Load POS settings ─────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/employee/pos/settings', { credentials: 'include' });
      if (res.ok) {
        const settings = await res.json();
        setPosSettings(settings);
        setIsSettingsLoaded(true);
      }
    } catch (err) {
      console.error('[Kiosk POS] Failed to load settings:', err);
    }
  }, [setPosSettings]);

  // ── Check for existing open session ───────────────────────────
  const checkSession = useCallback(async () => {
    if (!terminalId) return;
    try {
      const res = await fetch(
        `/api/employee/pos/sessions?status=OPEN&terminalId=${terminalId}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const { data } = await res.json();
        if (data && data.length > 0) {
          setCurrentSession(data[0] as KioskPosSession);
          return true;
        }
      }
    } catch (err) {
      console.error('[Kiosk POS] Failed to check session:', err);
    }
    return false;
  }, [terminalId, setCurrentSession]);

  // ── Initialize POS view ───────────────────────────────────────
  useEffect(() => {
    if (!isContextLoaded || !currentEmployee) return;

    // Check retail module is active
    if (!activeModules.includes('retail')) {
      setView('no-module');
      return;
    }

    const init = async () => {
      await loadSettings();
      const hasSession = await checkSession();
      setView(hasSession || currentSession ? 'register' : 'open-session');
    };

    init();
  }, [isContextLoaded, currentEmployee, activeModules, loadSettings, checkSession, currentSession]);

  // ── Handlers ──────────────────────────────────────────────────

  const handleSessionOpened = useCallback((session: KioskPosSession) => {
    setCurrentSession(session);
    setView('register');
  }, [setCurrentSession]);

  const handleRequestClose = useCallback(() => {
    setView('close-session');
  }, []);

  const handleSessionClosed = useCallback(() => {
    resetPosState();
    setView('open-session');
  }, [resetPosState]);

  const handleCancelClose = useCallback(() => {
    setView('register');
  }, []);

  const handleLock = useCallback(() => {
    router.push('/employee');
  }, [router]);

  // ── Render ────────────────────────────────────────────────────

  if (!isContextLoaded || !currentEmployee) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <KioskWrapper
      currentEmployee={currentEmployee as any}
      isOnline={isOnline}
      onLock={handleLock}
      companyName={companyName}
      terminalNumber={terminalNumber}
    >
      {view === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading POS Register...</p>
          </div>
        </div>
      )}

      {view === 'no-module' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              POS Not Available
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              The Retail & POS module is not active for this company. Please contact your administrator to enable it.
            </p>
            <button
              onClick={() => router.push('/employee/home')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium touch-manipulation"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {view === 'open-session' && (
        <OpenSessionScreen
          terminalId={terminalId!}
          employeeName={`${currentEmployee.firstName} ${currentEmployee.lastName}`}
          onSessionOpened={handleSessionOpened}
        />
      )}

      {view === 'register' && currentSession && (
        <RegisterScreen
          session={currentSession}
          onRequestCloseSession={handleRequestClose}
        />
      )}

      {view === 'close-session' && currentSession && (
        <CloseSessionScreen
          session={currentSession}
          onSessionClosed={handleSessionClosed}
          onCancel={handleCancelClose}
        />
      )}
    </KioskWrapper>
  );
}
