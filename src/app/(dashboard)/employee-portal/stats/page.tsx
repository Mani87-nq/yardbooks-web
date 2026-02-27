'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { api } from '@/lib/api-client';
import {
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────
interface EmployeeStats {
  period: {
    days: number;
    from: string;
    to: string;
  };
  stats: {
    totalShifts: number;
    hoursWorked: number;
    totalSales: number;
    totalRefunds: number;
    totalVoids: number;
    totalTips: number;
    totalTransactions: number;
    avgTicket: number;
    salesPerHour: number;
    avgShiftHours: number;
  };
}

// ── Component ────────────────────────────────────────────────────
export default function StatsPage() {
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const data = await api.get<EmployeeStats>(`/api/employee/me/stats?period=${period}`);
        setStats(data);
      } catch {
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [period]);

  const formatCurrency = (amount: number) =>
    `J$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 lg:p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <ChartBarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Performance Stats</h2>
            <p className="text-gray-500 dark:text-gray-400">
              {error || 'Unable to load your performance data.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = stats.stats;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Performance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Last {period} days performance metrics
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((days) => (
            <Button
              key={days}
              variant={period === days ? 'primary' : 'ghost'}
              onClick={() => setPeriod(days)}
              className="text-sm"
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Hours Worked */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <ClockIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Hours Worked</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.hoursWorked}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {s.totalShifts} shift{s.totalShifts !== 1 ? 's' : ''} | avg {s.avgShiftHours}h/shift
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Sales */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(s.totalSales)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Net: {formatCurrency(s.totalSales - s.totalRefunds)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <ShoppingCartIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Transactions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.totalTransactions}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Avg ticket: {formatCurrency(s.avgTicket)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales per Hour */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <ArrowTrendingUpIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Sales/Hour</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(s.salesPerHour)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <BanknotesIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Tips Earned</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(s.totalTips)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Refunds */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
                <CurrencyDollarIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Refunds</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(s.totalRefunds)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Voids: {formatCurrency(s.totalVoids)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period info */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Data from {new Date(stats.period.from).toLocaleDateString()} to{' '}
            {new Date(stats.period.to).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Back link */}
      <div className="text-center">
        <a
          href="/employee-portal"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          &larr; Back to Employee Portal
        </a>
      </div>
    </div>
  );
}
