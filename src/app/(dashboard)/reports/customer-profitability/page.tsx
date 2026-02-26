'use client';

import React, { useState } from 'react';
import {
  Card,
  Button,
  Input,
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
  UserGroupIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { printContent, downloadAsCSV, generateTable, generateStatCards, formatPrintCurrency } from '@/lib/print';
import { useAppStore } from '@/store/appStore';

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  revenueShare: number;
  invoiceCount: number;
  avgInvoiceValue: number;
  paidInvoices: number;
  overdueInvoices: number;
  outstandingBalance: number;
  paymentRate: number;
}

interface ProfitabilityReport {
  report: string;
  period: { startDate: string; endDate: string };
  currency: string;
  summary: {
    totalCustomers: number;
    totalRevenue: number;
    totalCOGS: number;
    totalGrossProfit: number;
    avgGrossMargin: number;
    totalOutstanding: number;
    top20PercentRevenue: number;
  };
  customers: CustomerRow[];
}

export default function CustomerProfitabilityPage() {
  const { fc } = useCurrency();
  const { activeCompany } = useAppStore();
  const now = new Date();
  const fyStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)
    : new Date(now.getFullYear() - 1, 3, 1);

  const [startDate, setStartDate] = useState(
    fyStart.toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    now.toISOString().split('T')[0]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-profitability', startDate, endDate],
    queryFn: () =>
      api.get<ProfitabilityReport>(
        `/api/v1/reports/customer-profitability?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!startDate && !!endDate,
  });

  const report: ProfitabilityReport | null = (data as any) ?? null;

  const handlePrint = () => {
    if (!report) return;
    const currency = report.currency ?? 'JMD';
    const summaryHtml = generateStatCards([
      { label: 'Total Customers', value: report.summary.totalCustomers.toString() },
      { label: 'Total Revenue', value: formatPrintCurrency(report.summary.totalRevenue, currency) },
      { label: 'Gross Profit', value: formatPrintCurrency(report.summary.totalGrossProfit, currency) },
      { label: 'Avg Gross Margin', value: `${report.summary.avgGrossMargin.toFixed(1)}%` },
    ]);
    const tableHtml = generateTable(
      [
        { key: 'name', label: 'Customer' },
        { key: 'revenue', label: 'Revenue', align: 'right' },
        { key: 'revenueShare', label: 'Share', align: 'right' },
        { key: 'grossProfit', label: 'Gross Profit', align: 'right' },
        { key: 'grossMargin', label: 'Margin', align: 'right' },
        { key: 'invoiceCount', label: 'Invoices', align: 'right' },
        { key: 'outstanding', label: 'Outstanding', align: 'right' },
      ],
      report.customers.map((cust) => ({
        name: cust.name,
        revenue: cust.revenue,
        revenueShare: `${cust.revenueShare.toFixed(1)}%`,
        grossProfit: cust.grossProfit,
        grossMargin: `${cust.grossMargin.toFixed(1)}%`,
        invoiceCount: cust.invoiceCount,
        outstanding: cust.outstandingBalance,
      })),
      {
        formatters: {
          revenue: (v: number) => formatPrintCurrency(v, currency),
          grossProfit: (v: number) => formatPrintCurrency(v, currency),
          outstanding: (v: number) => formatPrintCurrency(v, currency),
        },
      }
    );
    printContent({
      title: 'Customer Profitability',
      subtitle: `${report.period.startDate} to ${report.period.endDate}`,
      companyName: activeCompany?.businessName,
      companyTrn: activeCompany?.trnNumber,
      content: summaryHtml + tableHtml,
    });
  };

  const handleExportCSV = () => {
    if (!report) return;
    downloadAsCSV(
      report.customers.map((cust) => ({
        Customer: cust.name,
        Email: cust.email ?? '',
        Revenue: cust.revenue,
        'Revenue Share %': cust.revenueShare.toFixed(1),
        COGS: cust.cogs,
        'Gross Profit': cust.grossProfit,
        'Gross Margin %': cust.grossMargin.toFixed(1),
        Invoices: cust.invoiceCount,
        'Avg Invoice Value': cust.avgInvoiceValue,
        'Paid Invoices': cust.paidInvoices,
        'Overdue Invoices': cust.overdueInvoices,
        'Outstanding Balance': cust.outstandingBalance,
        'Payment Rate %': cust.paymentRate.toFixed(1),
      })),
      `customer-profitability-${startDate}-to-${endDate}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Customer Profitability
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Rank customers by revenue and gross profit contribution
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
            Failed to load customer profitability.{' '}
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
            <p className="text-gray-500 dark:text-gray-400">Analyzing customer profitability...</p>
          </div>
        </Card>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {report.summary.totalCustomers}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
                <p className="text-xl font-bold text-emerald-700">
                  {fc(report.summary.totalRevenue)}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Gross Profit</p>
                <p className="text-xl font-bold text-blue-700">
                  {fc(report.summary.totalGrossProfit)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {report.summary.avgGrossMargin.toFixed(1)}% margin
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
                <p
                  className={`text-xl font-bold ${
                    report.summary.totalOutstanding > 0
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {fc(report.summary.totalOutstanding)}
                </p>
              </div>
            </Card>
          </div>

          {/* Pareto insight */}
          {report.summary.totalCustomers > 1 && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800">
              <ChartBarIcon className="w-4 h-4 inline mr-1" />
              <span className="font-medium">Pareto Insight:</span> Top 20% of
              customers account for{' '}
              <span className="font-bold">
                {report.summary.top20PercentRevenue.toFixed(1)}%
              </span>{' '}
              of total revenue.
            </div>
          )}

          {/* Table */}
          <Card padding="none">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white dark:bg-gray-800 z-10">
                      Customer
                    </TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Avg Value</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.customers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="text-center py-12 text-gray-500 dark:text-gray-400"
                      >
                        <UserGroupIcon className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                        <p>No customer data for this period</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.customers.map((cust, idx) => (
                      <TableRow key={cust.id}>
                        <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-5">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {cust.name}
                              </p>
                              {cust.email && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  {cust.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {fc(cust.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-500 dark:text-gray-400">
                          {cust.revenueShare.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-gray-500 dark:text-gray-400">
                          {fc(cust.cogs)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm font-medium ${
                            cust.grossProfit >= 0
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {fc(cust.grossProfit)}
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm ${
                            cust.grossMargin >= 20
                              ? 'text-emerald-600'
                              : cust.grossMargin >= 0
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}
                        >
                          {cust.grossMargin.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {cust.invoiceCount}
                          {cust.overdueInvoices > 0 && (
                            <span className="text-xs text-red-500 ml-1">
                              ({cust.overdueInvoices} overdue)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-gray-500 dark:text-gray-400">
                          {fc(cust.avgInvoiceValue)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm ${
                            cust.outstandingBalance > 0
                              ? 'text-amber-600 font-medium'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {cust.outstandingBalance > 0
                            ? fc(cust.outstandingBalance)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span
                            className={
                              cust.paymentRate >= 80
                                ? 'text-emerald-600'
                                : cust.paymentRate >= 50
                                ? 'text-amber-600'
                                : 'text-red-600'
                            }
                          >
                            {cust.paymentRate.toFixed(0)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
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
