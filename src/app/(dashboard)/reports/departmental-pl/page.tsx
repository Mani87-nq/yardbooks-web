'use client';

import React, { useState } from 'react';
import {
  Card,
  Button,
  Input,
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
  BuildingOffice2Icon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface DepartmentReport {
  department: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  payrollCost: number;
  operatingExpenses: number;
  operatingIncome: number;
  otherExpenses: number;
  netIncome: number;
  netMargin: number;
  accounts: Array<{
    accountNumber: string;
    name: string;
    type: string;
    subType: string | null;
    balance: number;
  }>;
}

interface DeptPLReport {
  report: string;
  period: { startDate: string; endDate: string };
  currency: string;
  departments: DepartmentReport[];
  companyTotals: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    payrollCost: number;
    operatingExpenses: number;
    operatingIncome: number;
    otherExpenses: number;
    netIncome: number;
  };
}

export default function DepartmentalPLPage() {
  const { fc } = useCurrency();
  const now = new Date();
  const fyStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)
    : new Date(now.getFullYear() - 1, 3, 1);

  const [startDate, setStartDate] = useState(
    fyStart.toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['departmental-pl', startDate, endDate],
    queryFn: () =>
      api.get<DeptPLReport>(
        `/api/v1/reports/departmental-pl?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!startDate && !!endDate,
  });

  const report: DeptPLReport | null = (data as any) ?? null;

  const toggleDept = (dept: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const valueColor = (v: number) =>
    v >= 0 ? 'text-emerald-700' : 'text-red-700';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Departmental P&amp;L
          </h1>
          <p className="text-gray-500">
            Profit &amp; Loss breakdown by department
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800 flex-1">
            Failed to load departmental P&amp;L.{' '}
            {error instanceof Error ? error.message : ''}
          </p>
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
            <p className="text-gray-500">Generating departmental report...</p>
          </div>
        </Card>
      )}

      {report && (
        <>
          {/* Company Totals */}
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-800">Company Totals</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Revenue</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {fc(report.companyTotals.revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">COGS</p>
                  <p className="text-xl font-bold text-gray-700">
                    {fc(report.companyTotals.cogs)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Operating Income</p>
                  <p
                    className={`text-xl font-bold ${valueColor(
                      report.companyTotals.operatingIncome
                    )}`}
                  >
                    {fc(report.companyTotals.operatingIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Net Income</p>
                  <p
                    className={`text-xl font-bold ${valueColor(
                      report.companyTotals.netIncome
                    )}`}
                  >
                    {fc(report.companyTotals.netIncome)}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Department Breakdown Table */}
          <Card padding="none">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10">
                      Department
                    </TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Payroll</TableHead>
                    <TableHead className="text-right">OpEx</TableHead>
                    <TableHead className="text-right">Net Income</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.departments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-12 text-gray-500"
                      >
                        <BuildingOffice2Icon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p>No departmental data available</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Assign departments to employees in Payroll to see
                          breakdowns
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.departments.map((dept) => {
                      const isExpanded = expandedDepts.has(dept.department);
                      return (
                        <React.Fragment key={dept.department}>
                          <TableRow
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => toggleDept(dept.department)}
                          >
                            <TableCell className="sticky left-0 bg-white z-10">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="font-medium text-gray-900">
                                  {dept.department}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fc(dept.revenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-gray-500">
                              {fc(dept.cogs)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-sm font-medium ${valueColor(
                                dept.grossProfit
                              )}`}
                            >
                              {fc(dept.grossProfit)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {dept.grossMargin.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-gray-500">
                              {fc(dept.payrollCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-gray-500">
                              {fc(dept.operatingExpenses)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-sm font-bold ${valueColor(
                                dept.netIncome
                              )}`}
                            >
                              {fc(dept.netIncome)}
                            </TableCell>
                          </TableRow>
                          {/* Expanded account details */}
                          {isExpanded &&
                            dept.accounts.map((acct) => (
                              <TableRow
                                key={`${dept.department}-${acct.accountNumber}`}
                                className="bg-gray-50"
                              >
                                <TableCell className="sticky left-0 bg-gray-50 z-10 pl-12">
                                  <span className="text-xs text-gray-500">
                                    {acct.accountNumber} — {acct.name}
                                  </span>
                                </TableCell>
                                <TableCell
                                  colSpan={6}
                                  className="text-xs text-gray-400"
                                >
                                  {acct.type}
                                  {acct.subType ? ` / ${acct.subType}` : ''}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {fc(acct.balance)}
                                </TableCell>
                              </TableRow>
                            ))}
                        </React.Fragment>
                      );
                    })
                  )}
                  {/* Grand totals row */}
                  {report.departments.length > 0 && (
                    <TableRow className="bg-gray-100 font-bold">
                      <TableCell className="sticky left-0 bg-gray-100 z-10">
                        Grand Total
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fc(report.companyTotals.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-500">
                        {fc(report.companyTotals.cogs)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${valueColor(
                          report.companyTotals.grossProfit
                        )}`}
                      >
                        {fc(report.companyTotals.grossProfit)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono text-gray-500">
                        {fc(report.companyTotals.payrollCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-500">
                        {fc(report.companyTotals.operatingExpenses)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${valueColor(
                          report.companyTotals.netIncome
                        )}`}
                      >
                        {fc(report.companyTotals.netIncome)}
                      </TableCell>
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
