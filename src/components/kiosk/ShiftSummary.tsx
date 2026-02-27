'use client';

import React from 'react';

// ── Types ────────────────────────────────────────────────────────
interface ShiftSummaryData {
  hoursWorked: string | number;
  totalMinutes: number;
  breakMinutes: number;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  totalTips: number;
  transactionCount: number;
  cashVariance: number | null;
  expectedCash: number | null;
  closingCash: number | null;
}

interface ShiftSummaryProps {
  employeeName: string;
  shiftDate: string;
  clockIn: string;
  clockOut: string;
  summary: ShiftSummaryData;
  onClose?: () => void;
  onPrint?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return `J$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

// ── Component ────────────────────────────────────────────────────
export default function ShiftSummary({
  employeeName,
  shiftDate,
  clockIn,
  clockOut,
  summary,
  onClose,
  onPrint,
}: ShiftSummaryProps) {
  const netMinutes = summary.totalMinutes - summary.breakMinutes;
  const netSales = summary.totalSales - summary.totalRefunds;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-w-md w-full mx-auto">
      {/* Header */}
      <div className="px-6 py-4 bg-blue-600 dark:bg-blue-700 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Shift Summary</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-blue-500 transition-colors touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-blue-100 text-sm mt-1">{employeeName}</p>
        <p className="text-blue-200 text-xs mt-0.5">{shiftDate}</p>
      </div>

      {/* Time section */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Clock In</p>
            <p className="text-sm font-mono font-bold text-gray-900 dark:text-white mt-1">{clockIn}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Clock Out</p>
            <p className="text-sm font-mono font-bold text-gray-900 dark:text-white mt-1">{clockOut}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Net Hours</p>
            <p className="text-sm font-mono font-bold text-gray-900 dark:text-white mt-1">
              {typeof summary.hoursWorked === 'number' ? summary.hoursWorked.toFixed(2) : summary.hoursWorked}h
            </p>
          </div>
        </div>

        {summary.breakMinutes > 0 && (
          <div className="mt-2 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Total time: {formatDuration(summary.totalMinutes)} | Breaks: {formatDuration(summary.breakMinutes)} | Worked: {formatDuration(netMinutes)}
            </p>
          </div>
        )}
      </div>

      {/* Sales section */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total Sales</span>
          <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
            {formatCurrency(summary.totalSales)}
          </span>
        </div>

        {summary.totalRefunds > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Refunds</span>
            <span className="text-sm font-mono font-medium text-red-600 dark:text-red-400">
              -{formatCurrency(summary.totalRefunds)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-sm font-bold text-gray-900 dark:text-white">Net Sales</span>
          <span className="text-lg font-mono font-bold text-gray-900 dark:text-white">
            {formatCurrency(netSales)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Transactions</span>
          <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
            {summary.transactionCount}
          </span>
        </div>

        {summary.transactionCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Avg Ticket</span>
            <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
              {formatCurrency(netSales / summary.transactionCount)}
            </span>
          </div>
        )}
      </div>

      {/* Tips */}
      {summary.totalTips > 0 && (
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Tips</span>
            <span className="text-lg font-mono font-bold text-green-700 dark:text-green-300">
              {formatCurrency(summary.totalTips)}
            </span>
          </div>
        </div>
      )}

      {/* Voids */}
      {summary.totalVoids > 0 && (
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Voids</span>
            <span className="text-sm font-mono font-bold text-amber-700 dark:text-amber-300">
              {formatCurrency(summary.totalVoids)}
            </span>
          </div>
        </div>
      )}

      {/* Cash variance */}
      {summary.cashVariance !== null && (
        <div
          className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${
            summary.cashVariance === 0
              ? 'bg-green-50 dark:bg-green-900/20'
              : Math.abs(summary.cashVariance) <= 500
              ? 'bg-amber-50 dark:bg-amber-900/20'
              : 'bg-red-50 dark:bg-red-900/20'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Expected Cash</span>
              <span className="text-sm font-mono text-gray-900 dark:text-white">
                {formatCurrency(summary.expectedCash || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Actual Cash</span>
              <span className="text-sm font-mono text-gray-900 dark:text-white">
                {formatCurrency(summary.closingCash || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-sm font-bold text-gray-900 dark:text-white">Cash Variance</span>
              <span
                className={`text-lg font-mono font-bold ${
                  summary.cashVariance === 0
                    ? 'text-green-600 dark:text-green-400'
                    : summary.cashVariance > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {summary.cashVariance >= 0 ? '+' : ''}{formatCurrency(summary.cashVariance)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="px-6 py-4 flex gap-3">
        {onPrint && (
          <button
            onClick={onPrint}
            className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors touch-manipulation flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Print
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="flex-[2] py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold transition-colors touch-manipulation"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
