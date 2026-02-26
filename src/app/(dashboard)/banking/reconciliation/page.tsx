'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import {
  BuildingLibraryIcon,
  CheckCircleIcon,
  XCircleIcon,
  ScaleIcon,
  ArrowLeftIcon,
  DocumentCheckIcon,
  BanknotesIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function BankReconciliationPage() {
  const { bankAccounts, bankTransactions, journalEntries, glAccounts, updateBankTransaction } = useAppStore();
  const { fc } = useCurrency();

  // Selected bank account
  const [selectedAccountId, setSelectedAccountId] = useState<string>(bankAccounts[0]?.id ?? '');

  // Statement inputs
  const [statementDate, setStatementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState<string>('');

  // Checked items for matching
  const [checkedStatementItems, setCheckedStatementItems] = useState<Set<string>>(new Set());
  const [checkedBookItems, setCheckedBookItems] = useState<Set<string>>(new Set());

  // Reconciliation completed state
  const [isCompleted, setIsCompleted] = useState(false);

  const selectedAccount = useMemo(
    () => bankAccounts.find((a) => a.id === selectedAccountId) ?? null,
    [bankAccounts, selectedAccountId]
  );

  // Bank statement items: transactions for the selected account
  const statementTransactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return bankTransactions
      .filter((t) => t.bankAccountId === selectedAccountId)
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }, [bankTransactions, selectedAccountId]);

  // Book entries: journal entries that involve bank-related GL accounts
  const bankGLAccountIds = useMemo(() => {
    // Find GL accounts linked to bank accounts, or accounts that have 'bank' or 'cash' in the name
    const linkedIds = bankAccounts
      .filter((a) => a.linkedGLAccountCode)
      .map((a) => a.linkedGLAccountCode!);

    const bankRelatedAccounts = glAccounts.filter(
      (gl) =>
        linkedIds.includes(gl.id) ||
        linkedIds.includes(gl.accountNumber || '') ||
        gl.name?.toLowerCase().includes('bank') ||
        gl.name?.toLowerCase().includes('cash') ||
        gl.accountNumber?.startsWith('1000') ||
        gl.accountNumber?.startsWith('1001') ||
        gl.accountNumber?.startsWith('1010')
    );

    return new Set(bankRelatedAccounts.map((gl) => gl.id));
  }, [bankAccounts, glAccounts]);

  const bookEntries = useMemo(() => {
    return journalEntries
      .filter((je) => {
        if (je.status !== 'posted') return false;
        return je.lines.some((line) => bankGLAccountIds.has(line.accountId));
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [journalEntries, bankGLAccountIds]);

  // Parse statement balance
  const parsedStatementBalance = parseFloat(statementBalance) || 0;

  // Calculate outstanding items
  const outstandingDeposits = useMemo(() => {
    // Items checked in books but NOT checked on statement (deposits in books not yet on statement)
    return bookEntries
      .filter((je) => {
        const isInBooks = checkedBookItems.has(je.id);
        const bankLine = je.lines.find((l) => bankGLAccountIds.has(l.accountId));
        const isDebit = bankLine ? bankLine.debit > 0 : false;
        // Outstanding deposit = in books (checked), debit to bank, but not matched on statement
        return isInBooks && isDebit;
      })
      .reduce((sum, je) => {
        const bankLine = je.lines.find((l) => bankGLAccountIds.has(l.accountId));
        return sum + Number(bankLine?.debit ?? 0);
      }, 0);
  }, [bookEntries, checkedBookItems, bankGLAccountIds]);

  const outstandingChecks = useMemo(() => {
    // Items checked in books but NOT checked on statement (checks/withdrawals in books not yet on statement)
    return bookEntries
      .filter((je) => {
        const isInBooks = checkedBookItems.has(je.id);
        const bankLine = je.lines.find((l) => bankGLAccountIds.has(l.accountId));
        const isCredit = bankLine ? bankLine.credit > 0 : false;
        return isInBooks && isCredit;
      })
      .reduce((sum, je) => {
        const bankLine = je.lines.find((l) => bankGLAccountIds.has(l.accountId));
        return sum + Number(bankLine?.credit ?? 0);
      }, 0);
  }, [bookEntries, checkedBookItems, bankGLAccountIds]);

  // Reconciliation summary calculations
  const adjustedBankBalance = parsedStatementBalance + outstandingDeposits - outstandingChecks;
  const bookBalance = selectedAccount?.currentBalance ?? 0;
  const difference = adjustedBankBalance - bookBalance;
  const isReconciled = Math.abs(difference) < 0.01 && parsedStatementBalance !== 0;

  // Toggle statement item check
  const toggleStatementItem = (id: string) => {
    setCheckedStatementItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle book item check
  const toggleBookItem = (id: string) => {
    setCheckedBookItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const [reconciling, setReconciling] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  // Complete reconciliation — persist to DB via API
  const handleCompleteReconciliation = async () => {
    setReconciling(true);
    setReconcileError(null);
    try {
      // Send each checked transaction to the API to mark as reconciled
      const txnIds = Array.from(checkedStatementItems);
      await Promise.all(
        txnIds.map((txnId) =>
          api.put(`/api/v1/banking/transactions/${txnId}`, { isReconciled: true })
        )
      );
      // Also update Zustand store for instant UI feedback
      txnIds.forEach((txnId) => {
        updateBankTransaction(txnId, { isReconciled: true, reconciledAt: new Date() });
      });
      setIsCompleted(true);
    } catch (err: unknown) {
      setReconcileError(err instanceof Error ? err.message : 'Failed to save reconciliation');
    } finally {
      setReconciling(false);
    }
  };

  // Reset reconciliation
  const handleReset = () => {
    setCheckedStatementItems(new Set());
    setCheckedBookItems(new Set());
    setStatementBalance('');
    setStatementDate(new Date().toISOString().split('T')[0]);
    setIsCompleted(false);
  };

  // Handle account change
  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    setCheckedStatementItems(new Set());
    setCheckedBookItems(new Set());
    setIsCompleted(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/banking" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Reconciliation</h1>
          <p className="text-gray-500 dark:text-gray-400">Match bank statement items with book entries to reconcile your accounts</p>
        </div>
      </div>

      {/* Account Selection and Statement Info */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bank Account Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Select an account...</option>
                {bankAccounts.filter((a) => a.isActive).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountName} - {account.bankName}
                  </option>
                ))}
              </select>
            </div>

            {/* Statement Date */}
            <Input
              label="Statement Date"
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
            />

            {/* Statement Ending Balance */}
            <Input
              label="Statement Ending Balance"
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={(e) => setStatementBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {selectedAccount && (
            <div className="mt-4 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <BuildingLibraryIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Book Balance:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{fc(bookBalance)}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Last Synced:</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {selectedAccount.lastSyncedAt ? formatDate(selectedAccount.lastSyncedAt) : 'Never'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">Uncleared:</span>
                <Badge variant="warning">
                  {statementTransactions.filter((t) => !t.isReconciled).length} items
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-Column Layout */}
      {selectedAccountId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Bank Statement Items */}
          <Card padding="none">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BanknotesIcon className="w-5 h-5 text-blue-600" />
                  <CardTitle>Bank Statement Items</CardTitle>
                </div>
                <Badge variant="info">{statementTransactions.length} items</Badge>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Transactions from your bank statement</p>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {statementTransactions.length === 0 ? (
                <div className="p-8 text-center">
                  <BanknotesIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 dark:text-gray-400">No bank transactions found for this account</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Import transactions or add them manually</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {statementTransactions.map((txn) => {
                    const isDeposit = txn.amount >= 0;
                    const isChecked = checkedStatementItems.has(txn.id);

                    return (
                      <label
                        key={txn.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isChecked ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        } ${txn.isReconciled ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked || txn.isReconciled}
                          disabled={txn.isReconciled || isCompleted}
                          onChange={() => toggleStatementItem(txn.id)}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {txn.description}
                            </p>
                            <span className={`text-sm font-semibold whitespace-nowrap ml-2 ${
                              isDeposit ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {isDeposit ? '+' : ''}{fc(txn.amount)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(txn.transactionDate)}</span>
                            {txn.reference && (
                              <span className="text-xs text-gray-400">Ref: {txn.reference}</span>
                            )}
                            {txn.isReconciled && (
                              <Badge variant="success" size="sm">Reconciled</Badge>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {checkedStatementItems.size} of {statementTransactions.filter((t) => !t.isReconciled).length} selected
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Selected Total: {fc(
                    statementTransactions
                      .filter((t) => checkedStatementItems.has(t.id))
                      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </Card>

          {/* Right: Book Entries */}
          <Card padding="none">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DocumentCheckIcon className="w-5 h-5 text-purple-600" />
                  <CardTitle>Book Entries</CardTitle>
                </div>
                <Badge variant="info">{bookEntries.length} entries</Badge>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Journal entries related to bank accounts</p>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {bookEntries.length === 0 ? (
                <div className="p-8 text-center">
                  <DocumentCheckIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 dark:text-gray-400">No book entries found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Journal entries with bank account lines will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {bookEntries.map((je) => {
                    const bankLine = je.lines.find((l) => bankGLAccountIds.has(l.accountId));
                    const isDebit = bankLine ? bankLine.debit > 0 : false;
                    const amount = bankLine ? (bankLine.debit || bankLine.credit) : 0;
                    const isChecked = checkedBookItems.has(je.id);

                    return (
                      <label
                        key={je.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isChecked ? 'bg-purple-50 dark:bg-purple-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isCompleted}
                          onChange={() => toggleBookItem(je.id)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {je.description}
                            </p>
                            <span className={`text-sm font-semibold whitespace-nowrap ml-2 ${
                              isDebit ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {isDebit ? '+' : '-'}{fc(amount)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(je.date)}</span>
                            <span className="text-xs text-gray-400">#{je.entryNumber}</span>
                            {je.reference && (
                              <span className="text-xs text-gray-400">Ref: {je.reference}</span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {checkedBookItems.size} of {bookEntries.length} selected
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Selected Total: {fc(
                    bookEntries
                      .filter((je) => checkedBookItems.has(je.id))
                      .reduce((sum, je) => {
                        const bankLine = je.lines.find((l) => bankGLAccountIds.has(l.accountId));
                        return sum + Number(bankLine?.debit ?? 0) - Number(bankLine?.credit ?? 0);
                      }, 0)
                  )}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Reconciliation Summary */}
      {selectedAccountId && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ScaleIcon className="w-5 h-5 text-gray-600" />
              <CardTitle>Reconciliation Summary</CardTitle>
            </div>
            {/* Status Indicator */}
            {parsedStatementBalance !== 0 && (
              <div className="flex items-center gap-2">
                {isReconciled ? (
                  <>
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                    <Badge variant="success" size="md">Reconciled</Badge>
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-5 h-5 text-red-600" />
                    <Badge variant="danger" size="md">
                      Unreconciled ({fc(Math.abs(difference))} difference)
                    </Badge>
                  </>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Bank Side */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Adjusted Bank Balance</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Bank Statement Balance</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{fc(parsedStatementBalance)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Add: Outstanding Deposits
                      <span className="text-xs text-gray-400 ml-1">(in books, not on statement)</span>
                    </span>
                    <span className="text-sm font-semibold text-emerald-600">+{fc(outstandingDeposits)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Less: Outstanding Checks
                      <span className="text-xs text-gray-400 ml-1">(in books, not on statement)</span>
                    </span>
                    <span className="text-sm font-semibold text-red-600">-{fc(outstandingChecks)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 -mx-3">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Adjusted Bank Balance</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{fc(adjustedBankBalance)}</span>
                  </div>
                </div>
              </div>

              {/* Book Side */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Book Balance</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Book Balance (from GL)</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{fc(bookBalance)}</span>
                  </div>
                  <div className="py-2 border-t border-gray-100 dark:border-gray-700">
                    {/* Spacer to align with bank side */}
                  </div>
                  <div className="py-2 border-t border-gray-100 dark:border-gray-700">
                    {/* Spacer */}
                  </div>
                  <div className={`flex items-center justify-between py-3 border-t-2 rounded-lg px-3 -mx-3 ${
                    isReconciled
                      ? 'border-emerald-300 bg-emerald-50'
                      : difference !== 0
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300 bg-gray-50'
                  }`}>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Difference</span>
                    <span className={`text-lg font-bold ${
                      isReconciled
                        ? 'text-emerald-600'
                        : difference !== 0
                          ? 'text-red-600'
                          : 'text-gray-900'
                    }`}>
                      {fc(difference)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {reconcileError && (
              <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                {reconcileError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              {isCompleted ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircleIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Reconciliation completed successfully</span>
                  </div>
                  <Button variant="outline" onClick={handleReset}>
                    Start New Reconciliation
                  </Button>
                </div>
              ) : (
                <>
                  <Button variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                  <Button
                    onClick={handleCompleteReconciliation}
                    disabled={!isReconciled || checkedStatementItems.size === 0 || reconciling}
                    icon={<CheckCircleIcon className="w-4 h-4" />}
                  >
                    {reconciling ? 'Saving...' : 'Complete Reconciliation'}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedAccountId && (
        <Card>
          <CardContent className="text-center py-16">
            <ScaleIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a Bank Account</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Choose a bank account above to begin reconciling your bank statement with your book entries.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
