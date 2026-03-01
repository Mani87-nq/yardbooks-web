'use client';

import { useState, useCallback } from 'react';
import CashDrawerCount from '@/components/kiosk/CashDrawerCount';
import type { KioskPosSession } from '@/store/kioskPosStore';

interface OpenSessionScreenProps {
  terminalId: string;
  employeeName: string;
  onSessionOpened: (session: KioskPosSession) => void;
}

export default function OpenSessionScreen({
  terminalId,
  employeeName,
  onSessionOpened,
}: OpenSessionScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (result: { amount: number; denominations: Record<string, number>; variance: number | null }) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const res = await fetch('/api/employee/pos/sessions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            terminalId,
            openingCash: result.amount,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.detail ?? data?.title ?? 'Failed to open session');
        }

        const session = await res.json();
        onSessionOpened({
          id: session.id,
          terminalId: session.terminalId,
          terminalName: session.terminalName,
          cashierName: session.cashierName,
          openingCash: Number(session.openingCash),
          expectedCash: Number(session.expectedCash),
          totalSales: Number(session.totalSales ?? 0),
          totalRefunds: Number(session.totalRefunds ?? 0),
          netSales: Number(session.netSales ?? 0),
          status: session.status,
          openedAt: session.openedAt,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open session');
      } finally {
        setIsSubmitting(false);
      }
    },
    [terminalId, onSessionOpened]
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Open Cash Drawer
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Count your starting cash, <span className="font-medium">{employeeName}</span>
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
          title="Opening Cash Count"
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
