'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatJMD, formatDate } from '@/lib/utils';
import {
  ArrowDownTrayIcon,
  PrinterIcon,
  CalendarIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { printContent, generateTable, formatPrintCurrency, downloadAsCSV } from '@/lib/print';

// ---------------------------------------------------------------------------
// Types local to this page
// ---------------------------------------------------------------------------

interface AccountTransaction {
  date: string;
  entryNumber: string;
  description: string;
  lineDescription: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface AccountLedger {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  normalBalance: 'debit' | 'credit';
  openingBalance: number;
  transactions: AccountTransaction[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    asset: 'Asset',
    liability: 'Liability',
    equity: 'Equity',
    income: 'Income',
    expense: 'Expense',
  };
  return labels[type] || type;
}

function getAccountTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    asset: 'bg-blue-100 text-blue-700',
    liability: 'bg-red-100 text-red-700',
    equity: 'bg-purple-100 text-purple-700',
    income: 'bg-emerald-100 text-emerald-700',
    expense: 'bg-orange-100 text-orange-700',
  };
  return colors[type] || 'bg-gray-100 text-gray-700';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GeneralLedgerPage() {
  // Date range – defaults to start of current fiscal year through today
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };
  });

  // Account filter
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Expanded / collapsed sections
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // Store data
  const { glAccounts, journalEntries, activeCompany } = useAppStore();

  // ------------------------------------------------------------------
  // Build ledger data
  // ------------------------------------------------------------------

  const ledgerData: AccountLedger[] = useMemo(() => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    // Only consider posted entries
    const postedEntries = journalEntries.filter(
      (je) => je.status === 'posted'
    );

    // Sort entries by date ascending
    const sortedEntries = [...postedEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Determine which accounts to include
    const accountsToProcess =
      selectedAccountId === 'all'
        ? glAccounts.filter((a) => a.isActive && !a.isHeader)
        : glAccounts.filter((a) => a.id === selectedAccountId);

    // Sort accounts by account number
    const sortedAccounts = [...accountsToProcess].sort((a, b) =>
      (a.accountNumber || '').localeCompare(b.accountNumber || '', undefined, {
        numeric: true,
      })
    );

    return sortedAccounts.map((account) => {
      const normalBalance = account.normalBalance || (
        account.type === 'asset' || account.type === 'expense'
          ? 'debit'
          : 'credit'
      );

      // Compute opening balance from entries BEFORE the start date
      let openingBalance = 0;
      sortedEntries.forEach((je) => {
        const entryDate = new Date(je.date);
        if (entryDate < startDate) {
          je.lines.forEach((line) => {
            if (line.accountId === account.id) {
              if (normalBalance === 'debit') {
                openingBalance += line.debit - line.credit;
              } else {
                openingBalance += line.credit - line.debit;
              }
            }
          });
        }
      });

      // Gather transactions within the date range
      const transactions: AccountTransaction[] = [];
      let runningBalance = openingBalance;
      let totalDebits = 0;
      let totalCredits = 0;

      sortedEntries.forEach((je) => {
        const entryDate = new Date(je.date);
        if (entryDate >= startDate && entryDate <= endDate) {
          je.lines.forEach((line) => {
            if (line.accountId === account.id) {
              totalDebits += line.debit;
              totalCredits += line.credit;

              if (normalBalance === 'debit') {
                runningBalance += line.debit - line.credit;
              } else {
                runningBalance += line.credit - line.debit;
              }

              transactions.push({
                date: typeof je.date === 'string' ? je.date : new Date(je.date).toISOString(),
                entryNumber: je.entryNumber,
                description: je.description,
                lineDescription: line.description || je.description,
                debit: line.debit,
                credit: line.credit,
                runningBalance,
              });
            }
          });
        }
      });

      return {
        accountId: account.id,
        accountNumber: account.accountNumber,
        accountName: account.name,
        accountType: account.type,
        normalBalance,
        openingBalance,
        transactions,
        closingBalance: runningBalance,
        totalDebits,
        totalCredits,
      };
    });
  }, [glAccounts, journalEntries, dateRange, selectedAccountId]);

  // Only show accounts that have activity or a non-zero opening/closing balance
  const activeLedgers = useMemo(
    () =>
      ledgerData.filter(
        (l) =>
          l.transactions.length > 0 ||
          l.openingBalance !== 0 ||
          l.closingBalance !== 0
      ),
    [ledgerData]
  );

  // ------------------------------------------------------------------
  // Expand / collapse
  // ------------------------------------------------------------------

  const toggleAccount = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedAccounts(new Set(activeLedgers.map((l) => l.accountId)));
  };

  const collapseAll = () => {
    setExpandedAccounts(new Set());
  };

  // ------------------------------------------------------------------
  // Totals
  // ------------------------------------------------------------------

  const grandTotalDebits = activeLedgers.reduce((s, l) => s + l.totalDebits, 0);
  const grandTotalCredits = activeLedgers.reduce((s, l) => s + l.totalCredits, 0);

  // ------------------------------------------------------------------
  // Print
  // ------------------------------------------------------------------

  const handlePrint = () => {
    const dateSubtitle = `${formatDate(new Date(dateRange.start))} to ${formatDate(new Date(dateRange.end))}`;

    const accountSections = activeLedgers
      .map((ledger) => {
        const rows = ledger.transactions.map((t) => ({
          date: formatDate(new Date(t.date)),
          entryNumber: t.entryNumber,
          description: t.lineDescription,
          debit: t.debit > 0 ? formatPrintCurrency(t.debit) : '',
          credit: t.credit > 0 ? formatPrintCurrency(t.credit) : '',
          balance: formatPrintCurrency(t.runningBalance),
        }));

        const tableHtml = generateTable(
          [
            { key: 'date', label: 'Date' },
            { key: 'entryNumber', label: 'Entry #' },
            { key: 'description', label: 'Description' },
            { key: 'debit', label: 'Debit', align: 'right' },
            { key: 'credit', label: 'Credit', align: 'right' },
            { key: 'balance', label: 'Balance', align: 'right' },
          ],
          rows,
          {
            summaryRow: {
              date: '',
              entryNumber: '',
              description: 'Totals',
              debit: formatPrintCurrency(ledger.totalDebits),
              credit: formatPrintCurrency(ledger.totalCredits),
              balance: formatPrintCurrency(ledger.closingBalance),
            },
          }
        );

        return `
          <div style="margin-bottom:30px;page-break-inside:avoid;">
            <h3 style="font-weight:600;margin-bottom:4px;">${ledger.accountNumber} - ${ledger.accountName}</h3>
            <p style="font-size:12px;color:#6b7280;margin-bottom:8px;">Type: ${getAccountTypeLabel(ledger.accountType)} | Opening Balance: ${formatPrintCurrency(ledger.openingBalance)}</p>
            ${tableHtml}
          </div>
        `;
      })
      .join('');

    const summarySection = `
      <div style="margin-top:30px;padding:16px;background:#f9fafb;border-radius:8px;">
        <h3 style="font-weight:600;margin-bottom:8px;">Grand Totals</h3>
        <p>Total Debits: <strong>${formatPrintCurrency(grandTotalDebits)}</strong></p>
        <p>Total Credits: <strong>${formatPrintCurrency(grandTotalCredits)}</strong></p>
      </div>
    `;

    printContent({
      title: 'General Ledger',
      subtitle: dateSubtitle,
      companyName: activeCompany?.businessName,
      content: accountSections + summarySection,
    });
  };

  // ------------------------------------------------------------------
  // CSV Download
  // ------------------------------------------------------------------

  const handleDownloadCSV = () => {
    const rows: Record<string, any>[] = [];

    activeLedgers.forEach((ledger) => {
      // Opening balance row
      rows.push({
        'Account Number': ledger.accountNumber,
        'Account Name': ledger.accountName,
        'Account Type': getAccountTypeLabel(ledger.accountType),
        Date: '',
        'Entry Number': '',
        Description: 'Opening Balance',
        Debit: '',
        Credit: '',
        Balance: ledger.openingBalance,
      });

      ledger.transactions.forEach((t) => {
        rows.push({
          'Account Number': ledger.accountNumber,
          'Account Name': ledger.accountName,
          'Account Type': getAccountTypeLabel(ledger.accountType),
          Date: formatDate(new Date(t.date)),
          'Entry Number': t.entryNumber,
          Description: t.lineDescription,
          Debit: t.debit || '',
          Credit: t.credit || '',
          Balance: t.runningBalance,
        });
      });

      // Closing balance row
      rows.push({
        'Account Number': ledger.accountNumber,
        'Account Name': ledger.accountName,
        'Account Type': getAccountTypeLabel(ledger.accountType),
        Date: '',
        'Entry Number': '',
        Description: 'Closing Balance',
        Debit: ledger.totalDebits,
        Credit: ledger.totalCredits,
        Balance: ledger.closingBalance,
      });
    });

    downloadAsCSV(
      rows,
      `general-ledger-${dateRange.start}-to-${dateRange.end}`
    );
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Ledger</h1>
          <p className="text-gray-500">
            Detailed transaction history for all accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadCSV}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Date range */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <div className="flex items-center gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    From
                  </label>
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, start: e.target.value })
                    }
                    className="w-40"
                  />
                </div>
                <span className="text-gray-400 mt-5">to</span>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    To
                  </label>
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, end: e.target.value })
                    }
                    className="w-40"
                  />
                </div>
              </div>
            </div>

            {/* Quick date buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  setDateRange({
                    start: new Date(now.getFullYear(), now.getMonth(), 1)
                      .toISOString()
                      .split('T')[0],
                    end: now.toISOString().split('T')[0],
                  });
                }}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const endPrev = new Date(now.getFullYear(), now.getMonth(), 0);
                  setDateRange({
                    start: prevMonth.toISOString().split('T')[0],
                    end: endPrev.toISOString().split('T')[0],
                  });
                }}
              >
                Last Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  setDateRange({
                    start: new Date(now.getFullYear(), 0, 1)
                      .toISOString()
                      .split('T')[0],
                    end: now.toISOString().split('T')[0],
                  });
                }}
              >
                This Year
              </Button>
            </div>

            {/* Separator */}
            <div className="hidden lg:block w-px h-10 bg-gray-200" />

            {/* Account filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white min-w-[220px]"
                >
                  <option value="all">All Accounts</option>
                  {[...glAccounts]
                    .filter((a) => a.isActive && !a.isHeader)
                    .sort((a, b) =>
                      (a.accountNumber || '').localeCompare(
                        b.accountNumber || '',
                        undefined,
                        { numeric: true }
                      )
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountNumber} - {account.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Accounts Shown
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {activeLedgers.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Total Transactions
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {activeLedgers.reduce((s, l) => s + l.transactions.length, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Total Debits
            </p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {formatJMD(grandTotalDebits)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Total Credits
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {formatJMD(grandTotalCredits)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expand / Collapse controls */}
      {activeLedgers.length > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
          <span className="text-sm text-gray-400">
            {expandedAccounts.size} of {activeLedgers.length} expanded
          </span>
        </div>
      )}

      {/* Ledger sections */}
      {activeLedgers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 text-lg">
              No transactions found for the selected period.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Try adjusting the date range or account filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeLedgers.map((ledger) => {
            const isExpanded = expandedAccounts.has(ledger.accountId);

            return (
              <Card key={ledger.accountId} className="overflow-hidden">
                {/* Account header row */}
                <button
                  type="button"
                  onClick={() => toggleAccount(ledger.accountId)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-500">
                          {ledger.accountNumber}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {ledger.accountName}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getAccountTypeBadgeColor(
                            ledger.accountType
                          )}`}
                        >
                          {getAccountTypeLabel(ledger.accountType)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ledger.transactions.length} transaction
                        {ledger.transactions.length !== 1 ? 's' : ''} in period
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Opening</p>
                      <p className="font-medium text-gray-700">
                        {formatJMD(ledger.openingBalance)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Closing</p>
                      <p className="font-bold text-gray-900">
                        {formatJMD(ledger.closingBalance)}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Expanded transaction detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-600">
                            <th className="text-left px-5 py-3 font-semibold w-28">
                              Date
                            </th>
                            <th className="text-left px-3 py-3 font-semibold w-28">
                              Entry #
                            </th>
                            <th className="text-left px-3 py-3 font-semibold">
                              Description
                            </th>
                            <th className="text-right px-3 py-3 font-semibold w-32">
                              Debit
                            </th>
                            <th className="text-right px-3 py-3 font-semibold w-32">
                              Credit
                            </th>
                            <th className="text-right px-5 py-3 font-semibold w-36">
                              Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Opening balance row */}
                          <tr className="bg-emerald-50/50 border-b border-gray-100">
                            <td className="px-5 py-2.5 text-gray-500" colSpan={3}>
                              <span className="font-medium text-gray-700">
                                Opening Balance
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right" />
                            <td className="px-3 py-2.5 text-right" />
                            <td className="px-5 py-2.5 text-right font-semibold text-gray-800">
                              {formatJMD(ledger.openingBalance)}
                            </td>
                          </tr>

                          {/* Transaction rows */}
                          {ledger.transactions.map((txn, idx) => (
                            <tr
                              key={`${ledger.accountId}-${idx}`}
                              className={`border-b border-gray-50 hover:bg-gray-50/80 transition-colors ${
                                idx % 2 === 1 ? 'bg-gray-50/30' : ''
                              }`}
                            >
                              <td className="px-5 py-2.5 text-gray-600 whitespace-nowrap">
                                {formatDate(new Date(txn.date))}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                  {txn.entryNumber}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-gray-700">
                                {txn.lineDescription}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">
                                {txn.debit > 0 ? (
                                  <span className="text-blue-700">
                                    {formatJMD(txn.debit)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">&mdash;</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">
                                {txn.credit > 0 ? (
                                  <span className="text-emerald-700">
                                    {formatJMD(txn.credit)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">&mdash;</span>
                                )}
                              </td>
                              <td className="px-5 py-2.5 text-right font-mono font-medium text-gray-800">
                                {formatJMD(txn.runningBalance)}
                              </td>
                            </tr>
                          ))}

                          {/* Closing balance / totals row */}
                          <tr className="bg-gray-100 font-semibold">
                            <td className="px-5 py-3 text-gray-800" colSpan={3}>
                              Closing Balance
                            </td>
                            <td className="px-3 py-3 text-right text-blue-800 font-mono">
                              {formatJMD(ledger.totalDebits)}
                            </td>
                            <td className="px-3 py-3 text-right text-emerald-800 font-mono">
                              {formatJMD(ledger.totalCredits)}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-900 font-mono font-bold">
                              {formatJMD(ledger.closingBalance)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Grand totals footer */}
      {activeLedgers.length > 0 && (
        <Card className="bg-gray-50 border-2 border-gray-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  Grand Totals
                </h3>
                <p className="text-sm text-gray-500">
                  {formatDate(new Date(dateRange.start))} to{' '}
                  {formatDate(new Date(dateRange.end))}
                </p>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Total Debits
                  </p>
                  <p className="text-xl font-bold text-blue-700 font-mono">
                    {formatJMD(grandTotalDebits)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Total Credits
                  </p>
                  <p className="text-xl font-bold text-emerald-700 font-mono">
                    {formatJMD(grandTotalCredits)}
                  </p>
                </div>
                {grandTotalDebits === grandTotalCredits ? (
                  <Badge className="bg-emerald-100 text-emerald-700 px-3 py-1">
                    Balanced
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 px-3 py-1">
                    Unbalanced
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
