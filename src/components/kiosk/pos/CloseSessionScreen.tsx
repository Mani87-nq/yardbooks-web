'use client';

import { useState, useCallback, useEffect } from 'react';
import CashDrawerCount from '@/components/kiosk/CashDrawerCount';
import { useKioskPosStore, type KioskPosSession } from '@/store/kioskPosStore';

interface CloseSessionScreenProps {
  session: KioskPosSession;
  onSessionClosed: () => void;
  onCancel: () => void;
}

export default function CloseSessionScreen({
  session,
  onSessionClosed,
  onCancel,
}: CloseSessionScreenProps) {
  const { setCurrentSession } = useKioskPosStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshSession, setFreshSession] = useState<KioskPosSession>(session);
  const [closingResult, setClosingResult] = useState<{
    variance: number;
    closingCash: number;
  } | null>(null);

  // Refresh session data on mount to get latest expectedCash/totalSales
  useEffect(() => {
    const refreshSession = async () => {
      try {
        const res = await fetch(
          `/api/employee/pos/sessions?status=OPEN&terminalId=${session.terminalId}`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const { data } = await res.json();
          if (data && data.length > 0) {
            const updated = data[0] as KioskPosSession;
            setFreshSession(updated);
            setCurrentSession(updated);
          }
        }
      } catch {
        // Use stale session data if refresh fails
      }
    };
    refreshSession();
  }, [session.terminalId, setCurrentSession]);

  const formatCurrency = (amount: number) =>
    `J$${Math.abs(amount).toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleSubmit = useCallback(
    async (result: { amount: number; denominations: Record<string, number>; variance: number | null }) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const res = await fetch(`/api/employee/pos/sessions/${freshSession.id}/close`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            closingCash: result.amount,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.detail ?? data?.title ?? 'Failed to close session');
        }

        const closedSession = await res.json();
        const variance = Number(closedSession.cashVariance ?? 0);
        setClosingResult({
          variance,
          closingCash: result.amount,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to close session');
      } finally {
        setIsSubmitting(false);
      }
    },
    [freshSession.id]
  );

  // ── Closing Result Screen ─────────────────────────────────────
  if (closingResult) {
    const { variance, closingCash } = closingResult;
    const isBalanced = Math.abs(variance) < 0.01;
    const isOver = variance > 0;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md text-center">
          {/* Status Icon */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isBalanced
              ? 'bg-green-100 dark:bg-green-900/30'
              : isOver
              ? 'bg-blue-100 dark:bg-blue-900/30'
              : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            {isBalanced ? (
              <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isBalanced ? 'Drawer Balanced!' : isOver ? 'Drawer Over' : 'Drawer Short'}
          </h2>

          <p className={`text-lg font-mono font-semibold mb-6 ${
            isBalanced
              ? 'text-green-600 dark:text-green-400'
              : isOver
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {isBalanced ? 'No variance' : `${isOver ? '+' : '-'}${formatCurrency(variance)}`}
          </p>

          {/* Session Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 text-left">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Session Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Opening Cash</span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(freshSession.openingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Sales</span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(freshSession.totalSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Expected Cash</span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(freshSession.expectedCash)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <span className="text-gray-600 dark:text-gray-400">Counted Cash</span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(closingCash)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-gray-900 dark:text-white">Variance</span>
                <span className={`font-mono ${
                  isBalanced
                    ? 'text-green-600 dark:text-green-400'
                    : isOver
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {isBalanced ? 'J$0.00' : `${isOver ? '+' : '-'}${formatCurrency(variance)}`}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onSessionClosed}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg touch-manipulation transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Cash Counting Screen ──────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Close Cash Drawer
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Count the cash in your drawer
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Cash Drawer Count */}
        <CashDrawerCount
          title="Closing Cash Count"
          expectedAmount={freshSession.expectedCash}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
