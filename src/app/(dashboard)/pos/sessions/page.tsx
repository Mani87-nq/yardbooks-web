'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import { usePosStore } from '@/store/posStore';
import { formatJMD, cn } from '@/lib/utils';
import type { PosSession } from '@/types/pos';
import {
  ArrowLeftIcon,
  ClockIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChartBarIcon,
  UserIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

export default function SessionHistoryPage() {
  const [selectedCashier, setSelectedCashier] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  const sessions = usePosStore((state) => state.sessions);
  const getOrdersBySession = usePosStore((state) => state.getOrdersBySession);

  // Get unique cashiers
  const cashiers = useMemo(() => {
    const cashierMap = new Map<string, string>();
    sessions.forEach((s: PosSession) => {
      if (!cashierMap.has(s.cashierName)) {
        cashierMap.set(s.cashierName, s.cashierEmployeeNumber ? `Cashier #${s.cashierEmployeeNumber}` : s.cashierName);
      }
    });
    return Array.from(cashierMap.entries()).map(([value, label]) => ({ value, label }));
  }, [sessions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let filtered = [...sessions];

    // Filter by cashier
    if (selectedCashier) {
      filtered = filtered.filter((s: PosSession) => s.cashierName === selectedCashier);
    }

    // Filter by date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter((s: PosSession) => new Date(s.openedAt) >= today);
        break;
      case 'week':
        filtered = filtered.filter((s: PosSession) => new Date(s.openedAt) >= weekAgo);
        break;
      case 'month':
        filtered = filtered.filter((s: PosSession) => new Date(s.openedAt) >= monthAgo);
        break;
    }

    // Sort by most recent first
    return filtered.sort((a: PosSession, b: PosSession) =>
      new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
    );
  }, [sessions, selectedCashier, dateFilter]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const closedSessions = filteredSessions.filter((s: PosSession) => s.status === 'closed');
    const totalSales = closedSessions.reduce((sum: number, s: PosSession) => sum + s.netSales, 0);
    const totalVariance = closedSessions.reduce((sum: number, s: PosSession) => sum + (s.cashVariance || 0), 0);
    const sessionsWithVariance = closedSessions.filter((s: PosSession) => s.cashVariance && s.cashVariance !== 0).length;
    const avgSessionSales = closedSessions.length > 0 ? totalSales / closedSessions.length : 0;

    return {
      totalSessions: filteredSessions.length,
      closedSessions: closedSessions.length,
      openSessions: filteredSessions.filter((s: PosSession) => s.status === 'open').length,
      totalSales,
      totalVariance,
      sessionsWithVariance,
      avgSessionSales,
    };
  }, [filteredSessions]);

  // Cashier performance
  const cashierPerformance = useMemo(() => {
    const performance = new Map<string, {
      sessions: number;
      totalSales: number;
      totalVariance: number;
      perfectSessions: number;
      employeeNumber?: string;
    }>();

    sessions.filter((s: PosSession) => s.status === 'closed').forEach((session: PosSession) => {
      const existing = performance.get(session.cashierName) || {
        sessions: 0,
        totalSales: 0,
        totalVariance: 0,
        perfectSessions: 0,
      };

      performance.set(session.cashierName, {
        sessions: existing.sessions + 1,
        totalSales: existing.totalSales + session.netSales,
        totalVariance: existing.totalVariance + (session.cashVariance || 0),
        perfectSessions: existing.perfectSessions + (session.cashVariance === 0 ? 1 : 0),
        employeeNumber: session.cashierEmployeeNumber || existing.employeeNumber,
      });
    });

    return Array.from(performance.entries())
      .map(([name, stats]) => ({
        name: stats.employeeNumber ? `Cashier #${stats.employeeNumber}` : name,
        ...stats,
        avgSales: stats.sessions > 0 ? stats.totalSales / stats.sessions : 0,
        avgVariance: stats.sessions > 0 ? stats.totalVariance / stats.sessions : 0,
        accuracy: stats.sessions > 0 ? (stats.perfectSessions / stats.sessions) * 100 : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [sessions]);

  const getVarianceColor = (variance: number | undefined) => {
    if (!variance || variance === 0) return 'text-green-600';
    return Math.abs(variance) > 100 ? 'text-red-600' : 'text-yellow-600';
  };

  const getVarianceIcon = (variance: number | undefined) => {
    if (!variance || variance === 0) return CheckCircleIcon;
    return Math.abs(variance) > 100 ? XCircleIcon : ExclamationTriangleIcon;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pos">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to POS
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Session History</h1>
          <p className="text-gray-500">View all cashier sessions and performance</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.totalSessions}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {summaryStats.openSessions} active
                </p>
              </div>
              <ClockIcon className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-2xl font-bold text-emerald-600">{formatJMD(summaryStats.totalSales)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Avg: {formatJMD(summaryStats.avgSessionSales)}
                </p>
              </div>
              <BanknotesIcon className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Variance</p>
                <p className={cn(
                  "text-2xl font-bold",
                  summaryStats.totalVariance === 0 ? 'text-green-600' :
                  summaryStats.totalVariance > 0 ? 'text-blue-600' : 'text-red-600'
                )}>
                  {summaryStats.totalVariance >= 0 ? '+' : ''}{formatJMD(summaryStats.totalVariance)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {summaryStats.sessionsWithVariance} sessions
                </p>
              </div>
              <ChartBarIcon className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Perfect Sessions</p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryStats.closedSessions - summaryStats.sessionsWithVariance}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {summaryStats.closedSessions > 0
                    ? Math.round(((summaryStats.closedSessions - summaryStats.sessionsWithVariance) / summaryStats.closedSessions) * 100)
                    : 0}% accuracy
                </p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <UserIcon className="w-4 h-4 inline mr-1" />
                Cashier
              </label>
              <select
                value={selectedCashier || ''}
                onChange={(e) => setSelectedCashier(e.target.value || null)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">All Cashiers</option>
                {cashiers.map(cashier => (
                  <option key={cashier.value} value={cashier.value}>{cashier.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                Period
              </label>
              <div className="flex gap-2">
                {(['today', 'week', 'month', 'all'] as const).map(period => (
                  <button
                    key={period}
                    onClick={() => setDateFilter(period)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      dateFilter === period
                        ? "bg-emerald-600 text-white"
                        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cashier Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Cashier Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50">
                  <th className="px-4 py-3 font-medium">Cashier</th>
                  <th className="px-4 py-3 font-medium text-right">Sessions</th>
                  <th className="px-4 py-3 font-medium text-right">Total Sales</th>
                  <th className="px-4 py-3 font-medium text-right">Avg/Session</th>
                  <th className="px-4 py-3 font-medium text-right">Total Variance</th>
                  <th className="px-4 py-3 font-medium text-right">Avg Variance</th>
                  <th className="px-4 py-3 font-medium text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cashierPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No sessions found
                    </td>
                  </tr>
                ) : (
                  cashierPerformance.map(perf => (
                    <tr key={perf.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{perf.name}</td>
                      <td className="px-4 py-3 text-right">{perf.sessions}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatJMD(perf.totalSales)}</td>
                      <td className="px-4 py-3 text-right">{formatJMD(perf.avgSales)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-medium",
                          perf.totalVariance === 0 ? 'text-green-600' :
                          perf.totalVariance > 0 ? 'text-blue-600' : 'text-red-600'
                        )}>
                          {perf.totalVariance >= 0 ? '+' : ''}{formatJMD(perf.totalVariance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {perf.avgVariance >= 0 ? '+' : ''}{formatJMD(perf.avgVariance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={perf.accuracy >= 80 ? 'success' : perf.accuracy >= 50 ? 'warning' : 'danger'}>
                          {perf.accuracy.toFixed(0)}%
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle>All Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredSessions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No sessions found</p>
            ) : (
              filteredSessions.map((session: PosSession) => {
                const VarianceIcon = getVarianceIcon(session.cashVariance);
                return (
                  <div
                    key={session.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">{session.cashierEmployeeNumber ? `Cashier #${session.cashierEmployeeNumber}` : session.cashierName}</h3>
                          <Badge variant={session.status === 'open' ? 'info' : 'default'}>
                            {session.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500">Opened</p>
                            <p className="font-medium">{format(new Date(session.openedAt), 'MMM dd, HH:mm')}</p>
                          </div>
                          {session.closedAt && (
                            <div>
                              <p className="text-gray-500">Closed</p>
                              <p className="font-medium">{format(new Date(session.closedAt), 'HH:mm')}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-gray-500">Net Sales</p>
                            <p className="font-medium text-emerald-600">{formatJMD(session.netSales)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Orders</p>
                            <p className="font-medium">{session.orderIds.length}</p>
                          </div>
                        </div>
                      </div>
                      {session.status === 'closed' && (
                        <div className="text-right ml-4">
                          <div className={cn("flex items-center gap-2 justify-end", getVarianceColor(session.cashVariance))}>
                            <VarianceIcon className="w-5 h-5" />
                            <div>
                              <p className="text-xs">Variance</p>
                              <p className="text-lg font-bold">
                                {(session.cashVariance || 0) >= 0 ? '+' : ''}{formatJMD(session.cashVariance || 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
