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
  PrinterIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { printContent, downloadAsCSV, generateTable, generateStatCards, formatPrintCurrency } from '@/lib/print';
import { useAppStore } from '@/store/appStore';

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
  const { activeCompany } = useAppStore();
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

  const handlePrint = () => {
    if (!report) return;
    const currency = report.currency ?? 'JMD';
    const summaryHtml = generateStatCards([
      { label: 'Revenue', value: formatPrintCurrency(report.companyTotals.revenue, currency) },
      { label: 'COGS', value: formatPrintCurrency(report.companyTotals.cogs, currency) },
      { label: 'Operating Income', value: formatPrintCurrency(report.companyTotals.operatingIncome, currency), color: report.companyTotals.operatingIncome >= 0 ? '#059669' : '#dc2626' },
      { label: 'Net Income', value: formatPrintCurrency(report.companyTotals.netIncome, currency), color: report.companyTotals.netIncome >= 0 ? '#059669' : '#dc2626' },
    ]);
    const tableHtml = generateTable(
      [
        { key: 'department', label: 'Department' },
        { key: 'revenue', label: 'Revenue', align: 'right' },
        { key: 'cogs', label: 'COGS', align: 'right' },
        { key: 'grossProfit', label: 'Gross Profit', align: 'right' },
        { key: 'grossMargin', label: 'Margin', align: 'right' },
        { key: 'payroll', label: 'Payroll', align: 'right' },
        { key: 'opex', label: 'OpEx', align: 'right' },
        { key: 'netIncome', label: 'Net Income', align: 'right' },
      ],
      report.departments.map((dept) => ({
        department: dept.department,
        revenue: dept.revenue,
        cogs: dept.cogs,
        grossProfit: dept.grossProfit,
        grossMargin: `${dept.grossMargin.toFixed(1)}%`,
        payroll: dept.payrollCost,
        opex: dept.operatingExpenses,
        netIncome: dept.netIncome,
      })),
      {
        summaryRow: {
          department: 'Grand Total',
          revenue: report.companyTotals.revenue,
          cogs: report.companyTotals.cogs,
          grossProfit: report.companyTotals.grossProfit,
          grossMargin: '',
          payroll: report.companyTotals.payrollCost,
          opex: report.companyTotals.operatingExpenses,
          netIncome: report.companyTotals.netIncome,
        },
        formatters: {
          revenue: (v: number) => formatPrintCurrency(v, currency),
          cogs: (v: number) => formatPrintCurrency(v, currency),
          grossProfit: (v: number) => formatPrintCurrency(v, currency),
          payroll: (v: number) => formatPrintCurrency(v, currency),
          opex: (v: number) => formatPrintCurrency(v, currency),
          netIncome: (v: number) => formatPrintCurrency(v, currency),
        },
      }
    );
    printContent({
      title: 'Departmental P&L',
      subtitle: `${report.period.startDate} to ${report.period.endDate}`,
      companyName: activeCompany?.businessName,
      companyTrn: activeCompany?.trnNumber,
      content: summaryHtml + tableHtml,
    });
  };

  const handleExportCSV = () => {
    if (!report) return;
    downloadAsCSV(
      report.departments.map((dept) => ({
        Department: dept.department,
        Revenue: dept.revenue,
        COGS: dept.cogs,
        'Gross Profit': dept.grossProfit,
        'Gross Margin %': dept.grossMargin.toFixed(1),
        'Payroll Cost': dept.payrollCost,
        'Operating Expenses': dept.operatingExpenses,
        'Operating Income': dept.operatingIncome,
        'Other Expenses': dept.otherExpenses,
        'Net Income': dept.netIncome,
        'Net Margin %': dept.netMargin.toFixed(1),
      })),
      `departmental-pl-${startDate}-to-${endDate}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Departmental P&amp;L
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
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
            <span className="text-gray-400 dark:text-gray-500">to</span>
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

      {/* Print / Export Toolbar */}
      {report && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
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
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-gray-400 dark:text-gray-500 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Generating departmental report...</p>
          </div>
        </Card>
      )}

      {report && (
        <>
          {/* Company Totals */}
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">Company Totals</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Revenue</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {fc(report.companyTotals.revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">COGS</p>
                  <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                    {fc(report.companyTotals.cogs)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Operating Income</p>
                  <p
                    className={`text-xl font-bold ${valueColor(
                      report.companyTotals.operatingIncome
                    )}`}
                  >
                    {fc(report.companyTotals.operatingIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Net Income</p>
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
                    <TableHead className="sticky left-0 bg-white dark:bg-gray-800 z-10">
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
                        className="text-center py-12 text-gray-500 dark:text-gray-400"
                      >
                        <BuildingOffice2Icon className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                        <p>No departmental data available</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
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
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => toggleDept(dept.department)}
                          >
                            <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDownIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                ) : (
                                  <ChevronRightIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                )}
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {dept.department}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fc(dept.revenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-gray-500 dark:text-gray-400">
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
                            <TableCell className="text-right font-mono text-sm text-gray-500 dark:text-gray-400">
                              {fc(dept.payrollCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-gray-500 dark:text-gray-400">
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
                                className="bg-gray-50 dark:bg-gray-900"
                              >
                                <TableCell className="sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 pl-12">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {acct.accountNumber} — {acct.name}
                                  </span>
                                </TableCell>
                                <TableCell
                                  colSpan={6}
                                  className="text-xs text-gray-400 dark:text-gray-500"
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
                    <TableRow className="bg-gray-100 dark:bg-gray-700 font-bold">
                      <TableCell className="sticky left-0 bg-gray-100 dark:bg-gray-700 z-10">
                        Grand Total
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fc(report.companyTotals.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-500 dark:text-gray-400">
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
                      <TableCell className="text-right font-mono text-gray-500 dark:text-gray-400">
                        {fc(report.companyTotals.payrollCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-500 dark:text-gray-400">
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
