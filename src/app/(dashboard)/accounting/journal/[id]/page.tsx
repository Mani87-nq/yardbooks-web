'use client';

import { use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PencilIcon,
  PrinterIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/appStore';
import { printContent, generateTable, formatPrintCurrency } from '@/lib/print';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JournalEntryDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const glAccounts = useAppStore((state) => state.glAccounts);
  const updateJournalEntry = useAppStore((state) => state.updateJournalEntry);
  const activeCompany = useAppStore((state) => state.activeCompany);

  const entry = journalEntries.find((e) => e.id === id);

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <DocumentTextIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Journal Entry Not Found</h2>
        <Link href="/accounting/journal" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Back to Journal
        </Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;

  const getAccountName = (accountId: string) => {
    const account = glAccounts.find((a) => a.id === accountId);
    return account?.name || 'Unknown Account';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      posted: 'bg-green-100 text-green-700',
      void: 'bg-red-100 text-red-700',
      reversed: 'bg-orange-100 text-orange-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const handlePost = () => {
    updateJournalEntry?.(entry.id, { status: 'posted', postedAt: new Date() });
  };

  const handleVoid = () => {
    if (confirm('Are you sure you want to void this entry? This action cannot be undone.')) {
      updateJournalEntry?.(entry.id, { status: 'void' });
    }
  };

  const handlePrint = () => {
    const tableContent = generateTable(
      [
        { key: 'account', label: 'Account' },
        { key: 'description', label: 'Description' },
        { key: 'debit', label: 'Debit', align: 'right' },
        { key: 'credit', label: 'Credit', align: 'right' },
      ],
      entry.lines.map(line => ({
        account: line.accountName || getAccountName(line.accountId),
        description: line.description || '-',
        debit: line.debit > 0 ? line.debit : null,
        credit: line.credit > 0 ? line.credit : null,
      })),
      {
        formatters: {
          debit: (v: number | null) => v ? formatPrintCurrency(v) : '-',
          credit: (v: number | null) => v ? formatPrintCurrency(v) : '-',
        },
        summaryRow: {
          account: 'Total',
          description: '',
          debit: entry.totalDebits,
          credit: entry.totalCredits,
        },
      }
    );

    const balanceNote = entry.totalDebits === entry.totalCredits
      ? '<p style="margin-top:20px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#166534;"><strong>Entry is balanced</strong> - Total debits equal total credits</p>'
      : `<p style="margin-top:20px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;"><strong>Entry is NOT balanced</strong> - Difference: ${formatPrintCurrency(Math.abs(entry.totalDebits - entry.totalCredits))}</p>`;

    const content = `
      <table style="width:100%;margin-bottom:20px;border-collapse:collapse;">
        <tr><td style="padding:8px;color:#6b7280;">Date</td><td style="padding:8px;font-weight:500;">${format(new Date(entry.date), 'MMMM dd, yyyy')}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Entry Number</td><td style="padding:8px;font-weight:500;">${entry.entryNumber}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Status</td><td style="padding:8px;font-weight:500;text-transform:capitalize;">${entry.status}</td></tr>
        ${entry.description ? `<tr><td style="padding:8px;color:#6b7280;">Description</td><td style="padding:8px;font-weight:500;">${entry.description}</td></tr>` : ''}
      </table>
      <h3 style="margin: 20px 0 10px; font-weight: 600;">Line Items</h3>
      ${tableContent}
      ${balanceNote}
    `;

    printContent({
      title: 'Journal Entry',
      subtitle: `${entry.entryNumber} • ${format(new Date(entry.date), 'MMM dd, yyyy')}`,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/accounting/journal" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Journal Entry</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(entry.status)}`}>
                {entry.status}
              </span>
            </div>
            <p className="text-gray-500">{entry.entryNumber} • {format(new Date(entry.date), 'MMM dd, yyyy')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Print journal entry"
          >
            <PrinterIcon className="w-5 h-5 text-gray-600" />
          </button>
          {entry.status === 'draft' && (
            <>
              <Link
                href={`/accounting/journal/${entry.id}/edit`}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </Link>
              <button
                onClick={handlePost}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Post Entry
              </button>
            </>
          )}
          {entry.status === 'posted' && (
            <button
              onClick={handleVoid}
              className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              <XMarkIcon className="w-4 h-4" />
              Void
            </button>
          )}
        </div>
      </div>

      {/* Entry Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Entry Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Date</dt>
            <dd className="font-medium text-gray-900">{format(new Date(entry.date), 'MMMM dd, yyyy')}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Entry Number</dt>
            <dd className="font-medium text-gray-900">{entry.entryNumber}</dd>
          </div>
          {entry.sourceModule && (
            <div>
              <dt className="text-sm text-gray-500">Source</dt>
              <dd className="font-medium text-gray-900 capitalize">{entry.sourceModule.replace('_', ' ')}</dd>
            </div>
          )}
        </dl>
        {entry.description && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <dt className="text-sm text-gray-500 mb-1">Description</dt>
            <dd className="text-gray-900">{entry.description}</dd>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50">
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-right">Debit</th>
                <th className="px-4 py-3 font-medium text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entry.lines.map((line, index) => (
                <tr key={line.id || index} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/accounting/chart/${line.accountId}`}
                      className="font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      {line.accountName || getAccountName(line.accountId)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{line.description || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-right font-semibold text-gray-900">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {formatCurrency(entry.totalDebits)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {formatCurrency(entry.totalCredits)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Balance Check */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${
        entry.totalDebits === entry.totalCredits
          ? 'bg-green-50 border border-green-200'
          : 'bg-red-50 border border-red-200'
      }`}>
        {entry.totalDebits === entry.totalCredits ? (
          <>
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Entry is balanced</p>
              <p className="text-sm text-green-700">Total debits equal total credits</p>
            </div>
          </>
        ) : (
          <>
            <XMarkIcon className="w-6 h-6 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Entry is not balanced</p>
              <p className="text-sm text-red-700">
                Difference: {formatCurrency(Math.abs(entry.totalDebits - entry.totalCredits))}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Audit Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Audit Trail</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900">{format(new Date(entry.createdAt), 'MMM dd, yyyy HH:mm')}</dd>
          </div>
          {entry.postedAt && (
            <div>
              <dt className="text-gray-500">Posted</dt>
              <dd className="text-gray-900">{format(new Date(entry.postedAt), 'MMM dd, yyyy HH:mm')}</dd>
            </div>
          )}
          {entry.createdBy && (
            <div>
              <dt className="text-gray-500">Created By</dt>
              <dd className="text-gray-900">{entry.createdBy}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
