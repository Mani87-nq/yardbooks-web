'use client';

import React, { useState, useMemo, useCallback } from 'react';

// ── Jamaican Denominations ───────────────────────────────────────
const DENOMINATIONS = [
  { value: 5000, label: 'J$5,000', type: 'note' as const },
  { value: 2000, label: 'J$2,000', type: 'note' as const },
  { value: 1000, label: 'J$1,000', type: 'note' as const },
  { value: 500, label: 'J$500', type: 'note' as const },
  { value: 100, label: 'J$100', type: 'note' as const },
  { value: 50, label: 'J$50', type: 'coin' as const },
  { value: 25, label: 'J$25', type: 'coin' as const },
  { value: 20, label: 'J$20', type: 'coin' as const },
  { value: 10, label: 'J$10', type: 'coin' as const },
];

// ── Types ────────────────────────────────────────────────────────
interface CashDrawerCountProps {
  title?: string;
  expectedAmount?: number | null;
  onSubmit: (data: {
    amount: number;
    denominations: Record<string, number>;
    variance: number | null;
  }) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

// ── Component ────────────────────────────────────────────────────
export default function CashDrawerCount({
  title = 'Cash Drawer Count',
  expectedAmount = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CashDrawerCountProps) {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    DENOMINATIONS.forEach((d) => {
      initial[String(d.value)] = 0;
    });
    return initial;
  });

  const handleCountChange = useCallback((denomination: string, value: number) => {
    const sanitized = Math.max(0, Math.floor(value));
    setCounts((prev) => ({ ...prev, [denomination]: sanitized }));
  }, []);

  const handleIncrement = useCallback((denomination: string) => {
    setCounts((prev) => ({
      ...prev,
      [denomination]: (prev[denomination] || 0) + 1,
    }));
  }, []);

  const handleDecrement = useCallback((denomination: string) => {
    setCounts((prev) => ({
      ...prev,
      [denomination]: Math.max(0, (prev[denomination] || 0) - 1),
    }));
  }, []);

  const total = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => {
      return sum + (counts[String(d.value)] || 0) * d.value;
    }, 0);
  }, [counts]);

  const variance = useMemo(() => {
    if (expectedAmount === null || expectedAmount === undefined) return null;
    return total - expectedAmount;
  }, [total, expectedAmount]);

  const handleSubmit = useCallback(() => {
    onSubmit({
      amount: total,
      denominations: counts,
      variance,
    });
  }, [total, counts, variance, onSubmit]);

  const handleClear = useCallback(() => {
    const cleared: Record<string, number> = {};
    DENOMINATIONS.forEach((d) => {
      cleared[String(d.value)] = 0;
    });
    setCounts(cleared);
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-w-lg w-full mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        {expectedAmount !== null && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Expected: <span className="font-mono font-medium">J${expectedAmount.toLocaleString()}</span>
          </p>
        )}
      </div>

      {/* Denomination grid */}
      <div className="p-4 space-y-2">
        {/* Notes section */}
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Notes
          </p>
          {DENOMINATIONS.filter((d) => d.type === 'note').map((denom) => (
            <div
              key={denom.value}
              className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                {denom.label}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDecrement(String(denom.value))}
                  className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 transition-colors touch-manipulation flex items-center justify-center"
                >
                  -
                </button>
                <input
                  type="number"
                  value={counts[String(denom.value)] || 0}
                  onChange={(e) => handleCountChange(String(denom.value), parseInt(e.target.value) || 0)}
                  className="w-16 h-10 text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={0}
                />
                <button
                  onClick={() => handleIncrement(String(denom.value))}
                  className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 transition-colors touch-manipulation flex items-center justify-center"
                >
                  +
                </button>
              </div>

              <span className="text-sm font-mono text-gray-500 dark:text-gray-400 w-24 text-right">
                J${((counts[String(denom.value)] || 0) * denom.value).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Coins section */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Coins
          </p>
          {DENOMINATIONS.filter((d) => d.type === 'coin').map((denom) => (
            <div
              key={denom.value}
              className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                {denom.label}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDecrement(String(denom.value))}
                  className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 transition-colors touch-manipulation flex items-center justify-center"
                >
                  -
                </button>
                <input
                  type="number"
                  value={counts[String(denom.value)] || 0}
                  onChange={(e) => handleCountChange(String(denom.value), parseInt(e.target.value) || 0)}
                  className="w-16 h-10 text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={0}
                />
                <button
                  onClick={() => handleIncrement(String(denom.value))}
                  className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 transition-colors touch-manipulation flex items-center justify-center"
                >
                  +
                </button>
              </div>

              <span className="text-sm font-mono text-gray-500 dark:text-gray-400 w-24 text-right">
                J${((counts[String(denom.value)] || 0) * denom.value).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Total and variance */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
          <span className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
            J${total.toLocaleString()}
          </span>
        </div>

        {variance !== null && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Variance</span>
            <span
              className={`text-lg font-mono font-bold ${
                variance === 0
                  ? 'text-green-600 dark:text-green-400'
                  : variance > 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {variance >= 0 ? '+' : ''}J${variance.toLocaleString()}
              {variance === 0 && ' (exact)'}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <button
          onClick={handleClear}
          className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors touch-manipulation"
        >
          Clear
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors touch-manipulation"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-[2] py-3 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          {isSubmitting ? 'Submitting...' : 'Confirm Count'}
        </button>
      </div>
    </div>
  );
}
