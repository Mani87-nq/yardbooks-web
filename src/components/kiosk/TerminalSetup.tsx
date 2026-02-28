'use client';

import { useState, useEffect, useCallback } from 'react';
import { useKioskStore } from '@/store/kioskStore';

// ── Types ────────────────────────────────────────────────────────

interface TerminalSetupProps {
  /** Called when setup is complete (or skipped). */
  onComplete: () => void;
}

// ── Fingerprint Utility ──────────────────────────────────────────

/**
 * Generate a stable-ish device fingerprint from browser properties.
 * This isn't meant to be cryptographically unique — just stable enough
 * to recognise the same device + browser coming back.
 */
function generateFingerprint(): string {
  const parts: string[] = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    String(navigator.hardwareConcurrency || 0),
  ];
  return hashCode(parts.join('|'));
}

/** Simple string hash → hex */
function hashCode(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// ── Component ────────────────────────────────────────────────────

export default function TerminalSetup({ onComplete }: TerminalSetupProps) {
  const { setTerminal } = useKioskStore();
  const [status, setStatus] = useState<'checking' | 'new' | 'registering' | 'done' | 'error'>('checking');
  const [terminalNumber, setTerminalNumber] = useState<number | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Check if this device is already registered
  useEffect(() => {
    async function checkDevice() {
      try {
        const fingerprint = generateFingerprint();
        const res = await fetch(
          `/api/employee/terminal/register?fingerprint=${encodeURIComponent(fingerprint)}`,
          { credentials: 'include' }
        );

        if (!res.ok) {
          // Auth may have failed or device not found — show setup
          setStatus('new');
          return;
        }

        const data = await res.json();

        if (data.registered) {
          // Already registered — apply terminal info and proceed
          setTerminal(data.terminalId, data.terminalNumber);
          onComplete();
          return;
        }

        // Not registered — show setup screen
        setStatus('new');
      } catch {
        // Network error — skip terminal setup, proceed without it
        setStatus('new');
      }
    }

    checkDevice();
  }, [onComplete, setTerminal]);

  // Register this device
  const handleRegister = useCallback(async () => {
    setStatus('registering');
    setErrorMessage('');

    try {
      const fingerprint = generateFingerprint();
      const res = await fetch('/api/employee/terminal/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fingerprint,
          deviceName: deviceName.trim() || undefined,
          screenWidth: screen.width,
          screenHeight: screen.height,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.detail || 'Failed to register terminal. Please try again.');
        setStatus('error');
        return;
      }

      const data = await res.json();
      setTerminalNumber(data.terminalNumber);
      setTerminal(data.terminalId, data.terminalNumber);
      setStatus('done');

      // Auto-proceed after a brief confirmation display
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch {
      setErrorMessage('Unable to connect. Please check your network.');
      setStatus('error');
    }
  }, [deviceName, onComplete, setTerminal]);

  // Skip terminal setup
  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // ── Render: Checking ───────────────────────────────────────────
  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Checking terminal...
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Done ───────────────────────────────────────────────
  if (status === 'done') {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Terminal {terminalNumber}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Device registered successfully
          </p>
        </div>
      </div>
    );
  }

  // ── Render: New Device / Error ─────────────────────────────────
  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="text-center mb-8">
        {/* Terminal icon */}
        <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Set Up This Terminal
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          Register this device as a workstation terminal. It will be remembered
          for future logins.
        </p>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      )}

      {/* Device name input */}
      <div className="mb-6">
        <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Terminal Name <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="device-name"
          type="text"
          placeholder="e.g. Front Counter, Bar Station"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-colors text-base"
          maxLength={100}
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Leave blank to auto-assign a terminal number.
        </p>
      </div>

      {/* Register button */}
      <button
        onClick={handleRegister}
        disabled={status === 'registering'}
        className="w-full px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg transition-colors disabled:opacity-50 touch-manipulation mb-3"
      >
        {status === 'registering' ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Registering...</span>
          </div>
        ) : (
          'Register Terminal'
        )}
      </button>

      {/* Skip link */}
      <button
        onClick={handleSkip}
        className="w-full px-4 py-2 text-gray-500 dark:text-gray-400 text-sm font-medium hover:text-gray-700 dark:hover:text-gray-300 transition-colors touch-manipulation"
      >
        Skip for now
      </button>
    </div>
  );
}
