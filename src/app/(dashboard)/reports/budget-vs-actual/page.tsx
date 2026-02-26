'use client';

import React, { useState } from 'react';
import {
  Card,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import { useCurrency } from '@/hooks/useCurrency';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
  ScaleIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface MonthlyData {
  month: number;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number | null;
}

interface BudgetLine {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  months: MonthlyData[];
  ytd: {
    budget: number;
    actual: number;
    variance: number;
    variancePercent: number | null;
  };
}

interface BudgetReport {
  report: string;
  fiscalYear: number;
  budgetName: string;
  throughMonth: number;
  lines: BudgetLine[];
  totals: {
    budget: number;
    actual: number;
    variance: number;
  };
}

const MONTH_NAMES = [
  'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
  'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar',
];

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  INCOME: 'text-emerald-700',
  EXPENSE: 'text-red-700',
  ASSET: 'text-blue-700',
  LIABILITY: 'text-purple-700',
  EQUITY: 'text-gray-700',
};

export default function BudgetVsActualPage() {
  const { fc } = useCurrency();
  const now = new Date();
  const currentFY = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentFY.toString());
  const [throughMonth, setThroughMonth] = useState('12');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['budget-vs-actual', fiscalYear, throughMonth],
    queryFn: () =>
      api.get<BudgetReport>(
        `/api/v1/reports/budget-vs-actual?fiscalYear=${fiscalYear}&month=${throughMonth}`
      ),
    retry: false,
  });

  const report: BudgetReport | null = (data as any) ?? null;

  const varianceColor = (v: number) =>
    v >= 0 ? 'text-emerald-600' : 'text-red-600';

  const varianceIcon = (v: number) =>
    v >= 0 ? (
      <ArrowTrendingUpIcon className="w-3 h-3 inline mr-0.5" />
    ) : (
      <ArrowTrendingDownIcon className="w-3 h-3 inline mr-0.5" />
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Budget vs Actual
          </h1>
          <p className="text-gray-500">
            Compare budgeted amounts against actual GL activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">FY:</label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {[2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Through:</label>
            <select
              value={throughMonth}
              onChange={(e) => setThroughMonth(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>
                  {name} (Month {i + 1})
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-800 font-medium">
              {error instanceof Error
                ? error.message
                : 'Failed to load budget report'}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Make sure a budget has been created for FY {fiscalYear}. You can
              create budgets via the API.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <Card>
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
            <p className="text-gray-500">Loading budget report...</p>
          </div>
        </Card>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <div className="p-5">
                <p className="text-sm text-gray-500">Total Budget (YTD)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {fc(report.totals.budget)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {report.budgetName}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-5">
                <p className="text-sm text-gray-500">Total Actual (YTD)</p>
                <p className="text-2xl font-bold text-blue-700">
                  {fc(report.totals.actual)}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-5">
                <p className="text-sm text-gray-500">Total Variance</p>
                <p
                  className={`text-2xl font-bold ${varianceColor(
                    report.totals.variance
                  )}`}
                >
                  {varianceIcon(report.totals.variance)}
                  {fc(Math.abs(report.totals.variance))}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {report.totals.variance >= 0
                    ? 'Under budget'
                    : 'Over budget'}
                </p>
              </div>
            </Card>
          </div>

          {/* Detail Table */}
          <Card padding="none">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10">
                      Account
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Budget (YTD)</TableHead>
                    <TableHead className="text-right">Actual (YTD)</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Var %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.lines.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-12 text-gray-500"
                      >
                        <ScaleIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p>No budget lines found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.lines.map((line) => (
                      <TableRow key={line.accountId}>
                        <TableCell className="sticky left-0 bg-white z-10">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {line.accountNumber} - {line.accountName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-medium ${
                              ACCOUNT_TYPE_COLORS[line.accountType] ??
                              'text-gray-600'
                            }`}
                          >
                            {line.accountType}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fc(line.ytd.budget)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fc(line.ytd.actual)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm font-medium ${varianceColor(
                            line.ytd.variance
                          )}`}
                        >
                          {line.ytd.variance >= 0 ? '+' : ''}
                          {fc(line.ytd.variance)}
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm ${varianceColor(
                            line.ytd.variance
                          )}`}
                        >
                          {line.ytd.variancePercent !== null
                            ? `${line.ytd.variancePercent.toFixed(1)}%`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {/* Totals Row */}
                  {report.lines.length > 0 && (
                    <TableRow className="bg-gray-50 font-bold">
                      <TableCell className="sticky left-0 bg-gray-50 z-10">
                        Grand Total
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono">
                        {fc(report.totals.budget)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fc(report.totals.actual)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${varianceColor(
                          report.totals.variance
                        )}`}
                      >
                        {report.totals.variance >= 0 ? '+' : ''}
                        {fc(report.totals.variance)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
