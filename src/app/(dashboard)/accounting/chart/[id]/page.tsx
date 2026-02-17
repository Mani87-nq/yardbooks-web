'use client';

import { use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  CalculatorIcon,
  PencilIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/appStore';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AccountDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const glAccounts = useAppStore((state) => state.glAccounts);
  const journalEntries = useAppStore((state) => state.journalEntries);

  const account = glAccounts.find((a) => a.id === id);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <CalculatorIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Not Found</h2>
        <Link href="/accounting/chart" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Back to Chart of Accounts
        </Link>
      </div>
    );
  }

  // Get transactions affecting this account
  const accountTransactions = journalEntries
    .flatMap((entry) =>
      entry.lines
        .filter((line) => line.accountId === account.id)
        .map((line) => ({
          ...line,
          entry,
        }))
    )
    .sort((a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime());

  const formatCurrency = (amount: number | undefined) => `$${Math.abs(amount || 0).toLocaleString()}`;

  const getAccountTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      asset: 'bg-blue-100 text-blue-700',
      liability: 'bg-red-100 text-red-700',
      equity: 'bg-purple-100 text-purple-700',
      income: 'bg-green-100 text-green-700',
      expense: 'bg-orange-100 text-orange-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const currentBalance = account.currentBalance ?? account.balance ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/accounting/chart" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getAccountTypeColor(account.type)}`}>
                {account.type}
              </span>
            </div>
            <p className="text-gray-500">
              {account.accountNumber}
              {account.subType && ` • ${typeof account.subType === 'string' ? account.subType : account.subType}`}
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
          <PencilIcon className="w-4 h-4" />
          Edit
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Current Balance</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(currentBalance)}</p>
            <p className="text-sm text-gray-500 mt-1">
              {account.normalBalance === 'debit' ? 'Debit' : 'Credit'} balance
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">YTD Debits</p>
            <p className="text-2xl font-semibold text-gray-700">{formatCurrency(account.ytdDebits)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Status</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              account.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {account.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Transaction History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Transaction History</h2>
            </div>
            {accountTransactions.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {accountTransactions.slice(0, 20).map((transaction, index) => (
                  <div key={index} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          transaction.debit > 0 ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {transaction.debit > 0 ? (
                            <ArrowUpIcon className="w-5 h-5 text-blue-600" />
                          ) : (
                            <ArrowDownIcon className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{transaction.entry.description}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(transaction.entry.date), 'MMM dd, yyyy')} • {transaction.entry.entryNumber}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {transaction.debit > 0 && (
                          <p className="font-semibold text-blue-600">Dr {formatCurrency(transaction.debit)}</p>
                        )}
                        {transaction.credit > 0 && (
                          <p className="font-semibold text-green-600">Cr {formatCurrency(transaction.credit)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Account Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Account Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Account Number</dt>
                <dd className="font-medium text-gray-900">{account.accountNumber}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Account Type</dt>
                <dd className="font-medium text-gray-900 capitalize">{account.type}</dd>
              </div>
              {account.subType && (
                <div>
                  <dt className="text-sm text-gray-500">Sub Type</dt>
                  <dd className="font-medium text-gray-900 capitalize">
                    {typeof account.subType === 'string' ? account.subType.replace('_', ' ') : account.subType}
                  </dd>
                </div>
              )}
              {account.normalBalance && (
                <div>
                  <dt className="text-sm text-gray-500">Normal Balance</dt>
                  <dd className="font-medium text-gray-900 capitalize">{account.normalBalance}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Description */}
          {account.description && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
              <p className="text-gray-700">{account.description}</p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href={`/accounting/journal/new?account=${account.id}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                New Journal Entry
              </Link>
              <button className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Export Transactions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
