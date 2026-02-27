'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BanknotesIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  UserIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────────
interface TipRecord {
  id: string;
  serverName: string;
  serverId: string | null;
  amount: number;
  orderTotal: number;
  tableNumber: number;
  tableName: string | null;
  date: string | null;
  guestCount: number;
}

interface ServerBreakdown {
  name: string;
  total: number;
  count: number;
}

interface TipsSummary {
  totalTips: number;
  avgTip: number;
  transactionCount: number;
  serverBreakdown: ServerBreakdown[];
}

type PeriodKey = 'today' | 'week' | 'month';

// ── Format Currency ──────────────────────────────────────────────────
function formatJMD(amount: number): string {
  return `J$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// ── Stat Card ────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function TipsPage() {
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [summary, setSummary] = useState<TipsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('today');

  // Separate summary calls for stat cards
  const [todaySummary, setTodaySummary] = useState<TipsSummary | null>(null);
  const [weekSummary, setWeekSummary] = useState<TipsSummary | null>(null);
  const [monthSummary, setMonthSummary] = useState<TipsSummary | null>(null);

  const fetchTips = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/modules/restaurant/tips?period=${period}`);
      if (!res.ok) throw new Error('Failed to load tips');
      const data = await res.json();
      setTips(data.data || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tips');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchAllSummaries = useCallback(async () => {
    try {
      const [todayRes, weekRes, monthRes] = await Promise.all([
        fetch('/api/modules/restaurant/tips?period=today'),
        fetch('/api/modules/restaurant/tips?period=week'),
        fetch('/api/modules/restaurant/tips?period=month'),
      ]);

      if (todayRes.ok) {
        const d = await todayRes.json();
        setTodaySummary(d.summary);
      }
      if (weekRes.ok) {
        const d = await weekRes.json();
        setWeekSummary(d.summary);
      }
      if (monthRes.ok) {
        const d = await monthRes.json();
        setMonthSummary(d.summary);
      }
    } catch {
      // Summaries are supplemental — don't error the page
    }
  }, []);

  useEffect(() => {
    fetchTips();
  }, [fetchTips]);

  useEffect(() => {
    fetchAllSummaries();
  }, [fetchAllSummaries]);

  const handleRefresh = () => {
    fetchTips();
    fetchAllSummaries();
  };

  const periods: Array<{ key: PeriodKey; label: string }> = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BanknotesIcon className="w-7 h-7 text-emerald-600" />
            Tips
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track server tips and distributions
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 self-start disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={CurrencyDollarIcon}
          label="Today's Tips"
          value={formatJMD(todaySummary?.totalTips || 0)}
          subtext={`${todaySummary?.transactionCount || 0} transactions`}
          color="bg-emerald-600"
        />
        <StatCard
          icon={CalendarDaysIcon}
          label="This Week"
          value={formatJMD(weekSummary?.totalTips || 0)}
          subtext={`${weekSummary?.transactionCount || 0} transactions`}
          color="bg-blue-600"
        />
        <StatCard
          icon={ChartBarIcon}
          label="This Month"
          value={formatJMD(monthSummary?.totalTips || 0)}
          subtext={`${monthSummary?.transactionCount || 0} transactions`}
          color="bg-purple-600"
        />
      </div>

      {/* Period Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                period === p.key
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
          <ExclamationCircleIcon className="w-10 h-10 text-red-400" />
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Tips Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Recent Tips
              </h2>
              {summary && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Avg: {formatJMD(summary.avgTip)}
                </span>
              )}
            </div>

            {tips.length === 0 ? (
              <div className="p-12 text-center">
                <BanknotesIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">No tips recorded</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tips will appear here once table sessions with tips are closed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Server</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Tip</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Order Total</th>
                      <th className="text-center px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Table</th>
                      <th className="text-center px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Guests</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {tips.map((tip) => (
                      <tr key={tip.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                              <UserIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{tip.serverName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatJMD(tip.amount)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                          {formatJMD(tip.orderTotal)}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-600 dark:text-gray-300">
                          {tip.tableName || `T${tip.tableNumber}`}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-500 dark:text-gray-400">
                          {tip.guestCount}
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                          {tip.date
                            ? new Date(tip.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Server breakdown */}
          {summary && summary.serverBreakdown.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                Tips by Server
              </h2>
              <div className="space-y-3">
                {summary.serverBreakdown.map((server) => {
                  const percentage = summary.totalTips > 0 ? (server.total / summary.totalTips) * 100 : 0;
                  return (
                    <div key={server.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{server.name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            ({server.count} {server.count === 1 ? 'tip' : 'tips'})
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatJMD(server.total)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
