'use client';

import { useState, useCallback } from 'react';
import type { KioskPosSession } from '@/store/kioskPosStore';

// ── Types ───────────────────────────────────────────────────────

interface VoidOrderModalProps {
  orderId: string;
  orderNumber: string;
  session: KioskPosSession;
  onVoided: () => void;
  onClose: () => void;
}

const VOID_REASONS = [
  'Customer cancelled',
  'Wrong items',
  'Duplicate order',
  'Other',
] as const;

// ── Component ───────────────────────────────────────────────────

export default function VoidOrderModal({
  orderId,
  orderNumber,
  session,
  onVoided,
  onClose,
}: VoidOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsManagerOverride, setNeedsManagerOverride] = useState(false);

  const formatCurrency = (amount: number) =>
    `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Derive the final void reason
  const voidReason =
    selectedReason === 'Other'
      ? customReason.trim()
      : selectedReason;

  const canSubmit = !!voidReason && voidReason.length > 0 && !isSubmitting;

  // ── Reason Selection ────────────────────────────────────────

  const handleReasonSelect = useCallback((reason: string) => {
    setSelectedReason(reason);
    setError(null);
    setNeedsManagerOverride(false);
    if (reason !== 'Other') {
      setCustomReason('');
    }
  }, []);

  const handleCustomReasonChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCustomReason(e.target.value);
      setError(null);
    },
    []
  );

  // ── Submit Void ─────────────────────────────────────────────

  const handleConfirmVoid = useCallback(async () => {
    if (!voidReason) return;

    setIsSubmitting(true);
    setError(null);
    setNeedsManagerOverride(false);

    try {
      const res = await fetch(`/api/employee/pos/orders/${orderId}/void`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason }),
      });

      if (res.ok) {
        onVoided();
        return;
      }

      // Permission denied — manager override required
      if (res.status === 403) {
        setNeedsManagerOverride(true);
        setIsSubmitting(false);
        return;
      }

      const data = await res.json().catch(() => null);
      setError(data?.detail ?? 'Failed to void order. Please try again.');
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [orderId, voidReason, onVoided]);

  // ── Backdrop Click ──────────────────────────────────────────

  const handleBackdropClick = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleBackdropClick}
      />

      {/* Bottom Sheet / Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Void Order
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Order #{orderNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning Banner */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-300">
                This action cannot be undone. The order will be permanently voided.
              </p>
            </div>
          </div>

          {/* Manager Override Notice */}
          {needsManagerOverride && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3">
              <div className="flex gap-2">
                <svg className="w-5 h-5 text-orange-500 dark:text-orange-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                    Manager Override Required
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                    You do not have permission to void this order. Please ask a manager to authorize this action.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select a reason for voiding
            </label>
            <div className="grid grid-cols-2 gap-2">
              {VOID_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleReasonSelect(reason)}
                  disabled={isSubmitting}
                  className={`py-3 px-4 rounded-xl text-sm font-medium border-2 touch-manipulation transition-all min-h-[44px] ${
                    selectedReason === reason
                      ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Reason Input */}
          {selectedReason === 'Other' && (
            <div>
              <label
                htmlFor="custom-void-reason"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Specify reason
              </label>
              <input
                id="custom-void-reason"
                type="text"
                value={customReason}
                onChange={handleCustomReasonChange}
                placeholder="Enter void reason..."
                disabled={isSubmitting}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-transparent text-sm disabled:opacity-50 min-h-[44px]"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 touch-manipulation transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmVoid}
            disabled={!canSubmit}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold rounded-xl touch-manipulation transition-colors disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Voiding...</span>
              </>
            ) : (
              'Confirm Void'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
