'use client';

import { useState, useCallback, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────
interface DiscountModalProps {
  mode: 'item' | 'order';
  itemName?: string;
  currentTotal: number;
  onApply: (type: 'percent' | 'amount', value: number, reason: string) => void;
  onClose: () => void;
}

type DiscountTab = 'percent' | 'amount';

const PRESET_PERCENTAGES = [5, 10, 15, 20, 25];

// ── Component ────────────────────────────────────────────────────
export default function DiscountModal({
  mode,
  itemName,
  currentTotal,
  onApply,
  onClose,
}: DiscountModalProps) {
  const [activeTab, setActiveTab] = useState<DiscountTab>('percent');
  const [percentValue, setPercentValue] = useState('');
  const [amountValue, setAmountValue] = useState('');
  const [reason, setReason] = useState('');

  const formatCurrency = (amount: number) =>
    `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Computed discount amount for preview ───────────────────────
  const discountPreview = useMemo(() => {
    if (activeTab === 'percent') {
      const pct = parseFloat(percentValue);
      if (isNaN(pct) || pct <= 0) return 0;
      return (currentTotal * Math.min(pct, 100)) / 100;
    } else {
      const amt = parseFloat(amountValue);
      if (isNaN(amt) || amt <= 0) return 0;
      return Math.min(amt, currentTotal);
    }
  }, [activeTab, percentValue, amountValue, currentTotal]);

  // ── The current numeric value being entered ────────────────────
  const currentValue = useMemo(() => {
    if (activeTab === 'percent') {
      const pct = parseFloat(percentValue);
      return isNaN(pct) ? 0 : pct;
    } else {
      const amt = parseFloat(amountValue);
      return isNaN(amt) ? 0 : amt;
    }
  }, [activeTab, percentValue, amountValue]);

  // ── Whether the form is valid for submission ───────────────────
  const canApply = useMemo(() => {
    if (!reason.trim()) return false;
    if (currentValue <= 0) return false;
    if (activeTab === 'percent' && currentValue > 100) return false;
    if (activeTab === 'amount' && currentValue > currentTotal) return false;
    return true;
  }, [reason, currentValue, activeTab, currentTotal]);

  // ── Preset percentage handler ──────────────────────────────────
  const handlePresetPercent = useCallback((pct: number) => {
    setPercentValue(pct.toString());
  }, []);

  // ── Numpad handler ─────────────────────────────────────────────
  const handleNumpadPress = useCallback(
    (key: string) => {
      const setter = activeTab === 'percent' ? setPercentValue : setAmountValue;

      setter((prev) => {
        if (key === 'C') return '';
        if (key === 'backspace') return prev.slice(0, -1);
        if (key === '.') {
          if (prev.includes('.')) return prev;
          return (prev || '0') + '.';
        }
        // Limit to 2 decimal places
        const dotIndex = prev.indexOf('.');
        if (dotIndex !== -1 && prev.length - dotIndex > 2) return prev;
        return prev + key;
      });
    },
    [activeTab]
  );

  // ── Apply handler ──────────────────────────────────────────────
  const handleApply = useCallback(() => {
    if (!canApply) return;
    onApply(activeTab, currentValue, reason.trim());
  }, [canApply, activeTab, currentValue, reason, onApply]);

  // ── Title ──────────────────────────────────────────────────────
  const title = mode === 'item'
    ? `Discount: ${itemName || 'Item'}`
    : 'Order Discount';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6h.008v.008H6V6z"
                />
              </svg>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Current total context */}
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {mode === 'item' ? 'Item' : 'Order'} total:{' '}
            <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
              {formatCurrency(currentTotal)}
            </span>
          </p>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Tab Switcher */}
          <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
            <button
              onClick={() => setActiveTab('percent')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors touch-manipulation ${
                activeTab === 'percent'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Percentage
            </button>
            <button
              onClick={() => setActiveTab('amount')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors touch-manipulation ${
                activeTab === 'amount'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Fixed Amount
            </button>
          </div>

          {/* ── Percentage Tab ──────────────────────────────────── */}
          {activeTab === 'percent' && (
            <>
              {/* Preset buttons */}
              <div className="grid grid-cols-5 gap-2">
                {PRESET_PERCENTAGES.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handlePresetPercent(pct)}
                    className={`py-3 rounded-lg text-sm font-bold transition-colors touch-manipulation ${
                      percentValue === pct.toString()
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Custom entry display */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Custom Percentage
                </p>
                <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                  {percentValue ? `${percentValue}%` : '0%'}
                </p>
              </div>
            </>
          )}

          {/* ── Fixed Amount Tab ────────────────────────────────── */}
          {activeTab === 'amount' && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Discount Amount
              </p>
              <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                {amountValue ? `J$${amountValue}` : 'J$0.00'}
              </p>
            </div>
          )}

          {/* ── Numpad ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map(
              (key) => {
                if (key === 'backspace') {
                  return (
                    <button
                      key={key}
                      onClick={() => handleNumpadPress(key)}
                      className="h-12 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation flex items-center justify-center"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z"
                        />
                      </svg>
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    onClick={() => handleNumpadPress(key)}
                    className="h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-lg font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors touch-manipulation"
                  >
                    {key}
                  </button>
                );
              }
            )}
          </div>

          {/* Clear button */}
          <button
            onClick={() => handleNumpadPress('C')}
            className="w-full py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 touch-manipulation transition-colors"
          >
            Clear
          </button>

          {/* ── Discount Preview ────────────────────────────────── */}
          {discountPreview > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
              <p className="text-sm text-green-700 dark:text-green-300 font-semibold">
                Discount: {formatCurrency(discountPreview)}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                New total: {formatCurrency(Math.max(0, currentTotal - discountPreview))}
              </p>
            </div>
          )}

          {/* ── Reason Input ───────────────────────────────────── */}
          <div>
            <label
              htmlFor="discount-reason"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              id="discount-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Loyal customer, Damaged item, Manager approval"
              className="w-full px-3 py-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent touch-manipulation"
            />
            {!reason.trim() && currentValue > 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                A reason is required for the audit trail
              </p>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors touch-manipulation"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!canApply}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold transition-colors touch-manipulation disabled:cursor-not-allowed"
            >
              Apply Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
