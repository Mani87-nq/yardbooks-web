'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import {
  ArrowDownTrayIcon,
  PrinterIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { printContent, generateTable, downloadAsCSV } from '@/lib/print';
import type { GLAccountType } from '@/types/generalLedger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrialBalanceRow {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: GLAccountType;
  debit: number;
  credit: number;
}

interface AccountGroup {
  type: GLAccountType;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  accounts: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCOUNT_TYPE_ORDER: GLAccountType[] = [
  'asset',
  'liability',
  'equity',
  'income',
  'expense',
];

const ACCOUNT_TYPE_CONFIG: Record<
  GLAccountType,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  asset: {
    label: 'Assets',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  liability: {
    label: 'Liabilities',
    color: 'text-red-700',
    bgColor: 'bg-red-50 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  equity: {
    label: 'Equity',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  income: {
    label: 'Income',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  expense: {
    label: 'Expenses',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
};

/** Account types that normally carry a debit balance. */
const DEBIT_NORMAL_TYPES: Set<GLAccountType> = new Set(['asset', 'expense']);

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function TrialBalancePage() {
  const { fc, fcp } = useCurrency();
  const [asOfDate, setAsOfDate] = useState(
    () => new Date().toISOString().split('T')[0],
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<GLAccountType>>(
    () => new Set(),
  );

  const { glAccounts, journalEntries, activeCompany } = useAppStore();

  // -----------------------------------------------------------------------
  // Compute trial balance rows from journal entries
  // -----------------------------------------------------------------------

  const { groups, totalDebits, totalCredits, isBalanced, accountCount } =
    useMemo(() => {
      const cutoff = new Date(asOfDate);
      cutoff.setHours(23, 59, 59, 999);

      // Aggregate net debit/credit per account from posted journal entry lines
      const balances = new Map<string, number>();

      for (const entry of journalEntries) {
        // Only consider posted entries on or before the cutoff date
        if (entry.status !== 'posted') continue;
        const entryDate = new Date(entry.date);
        if (entryDate > cutoff) continue;

        for (const line of entry.lines) {
          const prev = balances.get(line.accountId) ?? 0;
          // Positive = net debit, negative = net credit
          balances.set(line.accountId, prev + line.debit - line.credit);
        }
      }

      // Build rows for every active GL account that has activity or a balance
      const rows: TrialBalanceRow[] = [];

      for (const account of glAccounts) {
        if (!account.isActive) continue;

        const netBalance = balances.get(account.id) ?? 0;

        // Skip accounts with zero balance and no journal activity
        if (netBalance === 0 && !balances.has(account.id)) continue;

        const isDebitNormal = DEBIT_NORMAL_TYPES.has(account.type);

        let debit = 0;
        let credit = 0;

        if (isDebitNormal) {
          // Asset & Expense: positive balance is a debit
          if (netBalance >= 0) {
            debit = netBalance;
          } else {
            credit = Math.abs(netBalance);
          }
        } else {
          // Liability, Equity, Income: positive balance (net debit) is unusual
          if (netBalance <= 0) {
            credit = Math.abs(netBalance);
          } else {
            debit = netBalance;
          }
        }

        rows.push({
          accountId: account.id,
          accountNumber: account.accountNumber,
          accountName: account.name,
          accountType: account.type,
          debit,
          credit,
        });
      }

      // Sort rows by account number within each type
      rows.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

      // Build groups
      const groupMap = new Map<GLAccountType, TrialBalanceRow[]>();
      for (const row of rows) {
        const list = groupMap.get(row.accountType) ?? [];
        list.push(row);
        groupMap.set(row.accountType, list);
      }

      const builtGroups: AccountGroup[] = ACCOUNT_TYPE_ORDER.filter((t) =>
        groupMap.has(t),
      ).map((type) => {
        const accounts = groupMap.get(type)!;
        const config = ACCOUNT_TYPE_CONFIG[type];
        return {
          type,
          ...config,
          accounts,
          totalDebit: accounts.reduce((s, a) => s + a.debit, 0),
          totalCredit: accounts.reduce((s, a) => s + a.credit, 0),
        };
      });

      const totalD = builtGroups.reduce((s, g) => s + g.totalDebit, 0);
      const totalC = builtGroups.reduce((s, g) => s + g.totalCredit, 0);

      return {
        groups: builtGroups,
        totalDebits: totalD,
        totalCredits: totalC,
        isBalanced: Math.abs(totalD - totalC) < 0.01,
        accountCount: rows.length,
      };
    }, [glAccounts, journalEntries, asOfDate]);

  // -----------------------------------------------------------------------
  // Collapse / expand
  // -----------------------------------------------------------------------

  const toggleGroup = (type: GLAccountType) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedGroups(new Set());
  const collapseAll = () =>
    setCollapsedGroups(new Set(ACCOUNT_TYPE_ORDER));

  // -----------------------------------------------------------------------
  // Print
  // -----------------------------------------------------------------------

  const handlePrint = () => {
    const allRows = groups.flatMap((g) => g.accounts);

    const tableHeaders = [
      { key: 'accountNumber', label: 'Account #' },
      { key: 'accountName', label: 'Account Name' },
      { key: 'type', label: 'Type' },
      { key: 'debit', label: 'Debit', align: 'right' as const },
      { key: 'credit', label: 'Credit', align: 'right' as const },
    ];

    const tableData = allRows.map((r) => ({
      accountNumber: r.accountNumber,
      accountName: r.accountName,
      type: ACCOUNT_TYPE_CONFIG[r.accountType].label,
      debit: r.debit,
      credit: r.credit,
    }));

    const content = generateTable(tableHeaders, tableData, {
      formatters: {
        debit: (v: number) => (v > 0 ? fcp(v) : '-'),
        credit: (v: number) => (v > 0 ? fcp(v) : '-'),
      },
      summaryRow: {
        accountNumber: '',
        accountName: 'Total',
        type: '',
        debit: totalDebits,
        credit: totalCredits,
      },
    });

    const balanceNote = isBalanced
      ? '<p style="margin-top:16px;color:#059669;font-weight:600;">Trial balance is in balance.</p>'
      : `<p style="margin-top:16px;color:#dc2626;font-weight:600;">Trial balance is out of balance by ${fcp(Math.abs(totalDebits - totalCredits))}.</p>`;

    printContent({
      title: 'Trial Balance',
      subtitle: `As of ${formatDate(new Date(asOfDate))}`,
      companyName: activeCompany?.businessName,
      content: content + balanceNote,
    });
  };

  // -----------------------------------------------------------------------
  // Download CSV
  // -----------------------------------------------------------------------

  const handleDownload = () => {
    const allRows = groups.flatMap((g) => g.accounts);

    const csvData = allRows.map((r) => ({
      'Account #': r.accountNumber,
      'Account Name': r.accountName,
      Type: ACCOUNT_TYPE_CONFIG[r.accountType].label,
      Debit: r.debit > 0 ? r.debit : '',
      Credit: r.credit > 0 ? r.credit : '',
    }));

    // Append totals row
    csvData.push({
      'Account #': '',
      'Account Name': 'TOTAL',
      Type: '',
      Debit: totalDebits as any,
      Credit: totalCredits as any,
    });

    downloadAsCSV(csvData, `trial-balance-${asOfDate}`);
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trial Balance</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Account balances from posted journal entries
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Date picker & summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* As-of date */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                As of Date
              </span>
            </div>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Total Debits */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Debits</p>
            <p className="text-2xl font-bold text-blue-600">
              {fc(totalDebits)}
            </p>
          </CardContent>
        </Card>

        {/* Total Credits */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Credits</p>
            <p className="text-2xl font-bold text-emerald-600">
              {fc(totalCredits)}
            </p>
          </CardContent>
        </Card>

        {/* Balance status */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            {isBalanced ? (
              <div className="flex items-center gap-2 mt-1">
                <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                <span className="text-lg font-bold text-emerald-600">
                  Balanced
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
                <div>
                  <span className="text-lg font-bold text-amber-600">
                    Unbalanced
                  </span>
                  <p className="text-xs text-amber-600">
                    Difference:{' '}
                    {fc(Math.abs(totalDebits - totalCredits))}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trial balance table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle>
              Trial Balance as of {formatDate(new Date(asOfDate))}
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="default">
                {accountCount} account{accountCount !== 1 ? 's' : ''}
              </Badge>
              <button
                onClick={expandAll}
                className="text-xs text-blue-600 hover:underline"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="text-xs text-blue-600 hover:underline"
              >
                Collapse All
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {groups.length === 0 ? (
            <div className="p-12 text-center text-gray-400 dark:text-gray-500">
              <p className="text-lg font-medium">No trial balance data</p>
              <p className="text-sm mt-1">
                Post journal entries to see account balances here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Table header */}
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                      Account #
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Account Name
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-44">
                      Debit
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-44">
                      Credit
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {groups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.type);

                    return (
                      <React.Fragment key={group.type}>
                        {/* Group header row */}
                        <tr
                          className={`${group.bgColor} border-t ${group.borderColor} cursor-pointer select-none`}
                          onClick={() => toggleGroup(group.type)}
                        >
                          <td
                            colSpan={2}
                            className={`px-6 py-3 font-semibold ${group.color}`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block transition-transform"
                                style={{
                                  transform: isCollapsed
                                    ? 'rotate(-90deg)'
                                    : 'rotate(0deg)',
                                }}
                              >
                                &#9662;
                              </span>
                              {group.label}
                              <span className="ml-2 text-xs font-normal opacity-70">
                                ({group.accounts.length} account
                                {group.accounts.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                          </td>
                          <td
                            className={`text-right px-6 py-3 font-semibold ${group.color}`}
                          >
                            {group.totalDebit > 0
                              ? fc(group.totalDebit)
                              : '-'}
                          </td>
                          <td
                            className={`text-right px-6 py-3 font-semibold ${group.color}`}
                          >
                            {group.totalCredit > 0
                              ? fc(group.totalCredit)
                              : '-'}
                          </td>
                        </tr>

                        {/* Account rows */}
                        {!isCollapsed &&
                          group.accounts.map((account, idx) => (
                            <tr
                              key={account.accountId}
                              className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                                idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'
                              }`}
                            >
                              <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {account.accountNumber}
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-800 dark:text-gray-100">
                                {account.accountName}
                              </td>
                              <td className="text-right px-6 py-3 text-sm font-medium tabular-nums">
                                {account.debit > 0 ? (
                                  <span className="text-gray-900 dark:text-white">
                                    {fc(account.debit)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                )}
                              </td>
                              <td className="text-right px-6 py-3 text-sm font-medium tabular-nums">
                                {account.credit > 0 ? (
                                  <span className="text-gray-900 dark:text-white">
                                    {fc(account.credit)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}

                  {/* Totals row */}
                  <tr
                    className={`border-t-2 ${
                      isBalanced ? 'border-emerald-300' : 'border-amber-300'
                    }`}
                  >
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-sm">
                      Total
                    </td>
                    <td className="text-right px-6 py-4 font-bold text-gray-900 dark:text-white text-sm tabular-nums">
                      {fc(totalDebits)}
                    </td>
                    <td className="text-right px-6 py-4 font-bold text-gray-900 dark:text-white text-sm tabular-nums">
                      {fc(totalCredits)}
                    </td>
                  </tr>

                  {/* Balance indicator row */}
                  <tr
                    className={
                      isBalanced
                        ? 'bg-emerald-50 dark:bg-emerald-900/30'
                        : 'bg-amber-50 dark:bg-amber-900/30'
                    }
                  >
                    <td colSpan={4} className="px-6 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {isBalanced ? (
                          <>
                            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                            <span className="text-sm font-semibold text-emerald-700">
                              Trial balance is in balance
                            </span>
                          </>
                        ) : (
                          <>
                            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                            <span className="text-sm font-semibold text-amber-700">
                              Out of balance by{' '}
                              {fc(Math.abs(totalDebits - totalCredits))}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report notes */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            This trial balance includes only posted journal entries on or before{' '}
            {formatDate(new Date(asOfDate))}. Draft and void entries are
            excluded. Assets and expenses normally carry debit balances;
            liabilities, equity, and income normally carry credit balances.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
