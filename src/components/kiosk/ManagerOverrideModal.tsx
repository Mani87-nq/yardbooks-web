'use client';

import React, { useState, useCallback, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────
interface ManagerOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionDescription: string;
  actionType: string;
  managers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    avatarColor: string;
    role: string;
  }>;
  onOverride: (managerProfileId: string, pin: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

// ── Component ────────────────────────────────────────────────────
export default function ManagerOverrideModal({
  isOpen,
  onClose,
  actionDescription,
  actionType,
  managers,
  onOverride,
}: ManagerOverrideModalProps) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedManager(null);
      setPin('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  const handlePinDigit = useCallback((digit: string) => {
    setPin((prev) => {
      if (prev.length >= 6) return prev;
      return prev + digit;
    });
    setError('');
  }, []);

  const handlePinDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedManager || pin.length < 4 || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const result = await onOverride(selectedManager, pin);

      if (!result.success) {
        setError(result.error || 'Override failed');
        setPin('');
      }
      // If success, the parent will close the modal
    } catch {
      setError('Override failed. Please try again.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  }, [selectedManager, pin, submitting, onOverride]);

  // Auto-submit on 4-digit PIN
  useEffect(() => {
    if (pin.length === 4 && selectedManager && !submitting) {
      handleSubmit();
    }
  }, [pin, selectedManager, submitting, handleSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">
                Manager Override Required
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Action being authorized */}
          <div className="mt-2 p-3 rounded-lg bg-white/50 dark:bg-gray-900/30">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Action:</span>{' '}
              <span className="uppercase font-bold text-amber-700 dark:text-amber-300">
                {actionType.replace(/_/g, ' ')}
              </span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {actionDescription}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {!selectedManager ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                Select a manager to authorize this action
              </p>

              {managers.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No managers available
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {managers.map((mgr) => (
                    <button
                      key={mgr.id}
                      onClick={() => setSelectedManager(mgr.id)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-amber-500 dark:hover:border-amber-400 transition-colors active:scale-95 touch-manipulation"
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: mgr.avatarColor }}
                      >
                        {(mgr.displayName || mgr.firstName).charAt(0)}
                        {mgr.lastName.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white text-center truncate w-full">
                        {mgr.displayName || `${mgr.firstName} ${mgr.lastName}`}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {mgr.role.replace('_', ' ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Back to manager selection */}
              <button
                onClick={() => { setSelectedManager(null); setPin(''); setError(''); }}
                className="mb-4 text-sm text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
              >
                &larr; Back to manager selection
              </button>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                Manager: enter your PIN
              </p>

              {/* PIN dots */}
              <div className="flex justify-center gap-3 mb-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                      i < pin.length
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-center">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Loading */}
              {submitting && (
                <div className="flex justify-center mb-3">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Compact number pad */}
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, idx) => {
                  if (key === '') return <div key={idx} />;
                  if (key === 'del') {
                    return (
                      <button
                        key={idx}
                        onClick={handlePinDelete}
                        disabled={submitting}
                        className="w-16 h-16 mx-auto rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 touch-manipulation flex items-center justify-center"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                        </svg>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handlePinDigit(key)}
                      disabled={submitting}
                      className="w-16 h-16 mx-auto rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-xl font-bold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 touch-manipulation"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors touch-manipulation"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
