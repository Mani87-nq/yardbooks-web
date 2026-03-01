'use client';

import { useState, useCallback } from 'react';
import type { KioskPosSession } from '@/store/kioskPosStore';

// ── Types ────────────────────────────────────────────────────────

type MovementType = 'DROP' | 'PAYOUT';

interface CashMovementModalProps {
  session: KioskPosSession;
  onComplete: () => void;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────

export default function CashMovementModal({
  session,
  onComplete,
  onClose,
}: CashMovementModalProps) {
  const [movementType, setMovementType] = useState<MovementType | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Derived Values ───────────────────────────────────────────

  const parsedAmount = parseFloat(amount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const canSubmit = movementType !== null && isValidAmount && reason.trim().length > 0 && !isSubmitting;

  // ── Numpad Handler ───────────────────────────────────────────

  const handleNumpadPress = useCallback((key: string) => {
    setAmount((prev) => {
      if (key === 'C') return '';
      if (key === '⌫') return prev.slice(0, -1);
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return (prev || '0') + '.';
      }
      // Limit to 2 decimal places
      const dotIndex = prev.indexOf('.');
      if (dotIndex !== -1 && prev.length - dotIndex > 2) return prev;
      return prev + key;
    });
  }, []);

  // ── Submit Handler ───────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/employee/pos/sessions/${session.id}/cash-movement`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: movementType,
          amount: parsedAmount,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? data?.title ?? 'Failed to record cash movement');
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record cash movement');
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, session.id, movementType, parsedAmount, reason, onComplete]);

  // ── Format helper ────────────────────────────────────────────

  const formatCurrency = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || val === '') return 'J$0.00';
    return `J$${val}`;
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Cash Movement
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 touch-manipulation transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Type Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Movement Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMovementType('DROP')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 touch-manipulation transition-all min-h-[88px] ${
                  movementType === 'DROP'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <svg
                  className={`w-7 h-7 mb-1.5 ${
                    movementType === 'DROP'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span
                  className={`text-sm font-semibold ${
                    movementType === 'DROP'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  Cash Drop
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Remove to safe
                </span>
              </button>

              <button
                onClick={() => setMovementType('PAYOUT')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 touch-manipulation transition-all min-h-[88px] ${
                  movementType === 'PAYOUT'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <svg
                  className={`w-7 h-7 mb-1.5 ${
                    movementType === 'PAYOUT'
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span
                  className={`text-sm font-semibold ${
                    movementType === 'PAYOUT'
                      ? 'text-orange-700 dark:text-orange-300'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  Payout
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Pay expense
                </span>
              </button>
            </div>
          </div>

          {/* Amount Display */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Amount
            </label>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-center">
              <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                {formatCurrency(amount)}
              </p>
            </div>
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
              <button
                key={key}
                onClick={() => handleNumpadPress(key)}
                className="py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-lg font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 touch-manipulation transition-colors min-h-[44px]"
              >
                {key}
              </button>
            ))}
            <button
              onClick={() => handleNumpadPress('C')}
              className="col-span-3 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 touch-manipulation transition-colors min-h-[44px]"
            >
              Clear
            </button>
          </div>

          {/* Reason */}
          <div>
            <label
              htmlFor="cash-movement-reason"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              id="cash-movement-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                movementType === 'DROP'
                  ? 'e.g. End-of-shift safe deposit'
                  : movementType === 'PAYOUT'
                  ? 'e.g. Purchased cleaning supplies'
                  : 'Enter reason for cash movement'
              }
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent touch-manipulation text-sm"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 touch-manipulation transition-colors disabled:opacity-50 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold rounded-xl touch-manipulation transition-colors disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Submitting...</span>
              </>
            ) : (
              <span>
                {movementType === 'DROP'
                  ? 'Record Cash Drop'
                  : movementType === 'PAYOUT'
                  ? 'Record Payout'
                  : 'Record Movement'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
