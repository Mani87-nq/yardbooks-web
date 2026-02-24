'use client';

import { use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  BuildingLibraryIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PencilIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/appStore';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BankAccountDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const bankAccounts = useAppStore((state) => state.bankAccounts);
  const bankTransactions = useAppStore((state) => state.bankTransactions);

  const account = bankAccounts.find((a) => a.id === id);
  const transactions = bankTransactions.filter((t) => t.bankAccountId === id);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <BuildingLibraryIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Not Found</h2>
        <Link href="/banking" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Back to Banking
        </Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
    .slice(0, 20);

  // Calculate money in/out based on amount sign (positive = credit, negative = debit)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const moneyIn = transactions
    .filter((t) => t.amount > 0 && new Date(t.transactionDate) > thirtyDaysAgo)
    .reduce((sum, t) => sum + t.amount, 0);
  const moneyOut = transactions
    .filter((t) => t.amount < 0 && new Date(t.transactionDate) > thirtyDaysAgo)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const transactionsCount = transactions.filter((t) => new Date(t.transactionDate) > thirtyDaysAgo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/banking" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <BuildingLibraryIcon className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{account.accountName}</h1>
              <p className="text-gray-500">{account.bankName} • ****{account.accountNumber.slice(-4)}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/banking/reconciliation"
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Reconcile
          </Link>
          <button className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Current Balance</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(account.currentBalance)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Available Balance</p>
          <p className="text-3xl font-bold text-emerald-600">{formatCurrency(account.availableBalance)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Account Type</p>
          <p className="text-xl font-semibold text-gray-900 capitalize">{account.accountType}</p>
          <p className="text-sm text-gray-500">{account.currency}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <ArrowDownIcon className="w-4 h-4" />
            <span className="text-sm">Money In (30d)</span>
          </div>
          <p className="text-xl font-bold text-green-700">{formatCurrency(moneyIn)}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <ArrowUpIcon className="w-4 h-4" />
            <span className="text-sm">Money Out (30d)</span>
          </div>
          <p className="text-xl font-bold text-red-700">{formatCurrency(moneyOut)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="text-blue-600 text-sm mb-1">Transactions (30d)</div>
          <p className="text-xl font-bold text-blue-700">{transactionsCount}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="text-gray-600 text-sm mb-1">Unreconciled</div>
          <p className="text-xl font-bold text-gray-700">
            {transactions.filter((t) => !t.isReconciled).length}
          </p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
          <Link href={`/banking?account=${account.id}`} className="text-sm text-emerald-600 hover:text-emerald-700">
            View All
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentTransactions.map((transaction) => {
              const isCredit = transaction.amount > 0;
              return (
                <div key={transaction.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCredit ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {isCredit ? (
                          <ArrowDownIcon className="w-5 h-5 text-green-600" />
                        ) : (
                          <ArrowUpIcon className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{transaction.description}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(transaction.transactionDate), 'MMM dd, yyyy')}
                          {transaction.category && ` • ${transaction.category}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                        {isCredit ? '+' : ''}{formatCurrency(transaction.amount)}
                      </p>
                      {!transaction.isReconciled && (
                        <span className="text-xs text-orange-600">Unreconciled</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
