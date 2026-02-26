'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useCurrency } from '@/hooks/useCurrency';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  CalculatorIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { printContent, downloadAsCSV, generateStatCards, formatPrintCurrency } from '@/lib/print';
import { useAppStore } from '@/store/appStore';

interface KPIData {
  // Revenue
  revenueCurrentMonth: number;
  revenueYTD: number;
  revenuePrevMonth: number;
  revenueGrowthMoM: number;
  // Profitability
  grossProfitCurrentMonth: number;
  grossMarginCurrentMonth: number;
  grossProfitYTD: number;
  grossMarginYTD: number;
  netIncomeCurrentMonth: number;
  netMarginCurrentMonth: number;
  netIncomeYTD: number;
  netMarginYTD: number;
  // Liquidity
  cashOnHand: number;
  currentRatio: number | null;
  quickRatio: number | null;
  cashRunwayMonths: number | null;
  // Efficiency
  arDays: number | null;
  apDays: number | null;
  totalAR: number;
  totalAP: number;
  // Payroll
  payrollCostYTD: number;
  payrollPercentOfRevenue: number;
  totalEmployees: number;
  // Activity
  openInvoices: number;
  overdueInvoices: number;
  monthlyBurnRate: number;
}

interface KPIResponse {
  report: string;
  asOfDate: string;
  fiscalYearStart: string;
  currency: string;
  kpis: KPIData;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  color = 'text-gray-900',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number | null;
  trendLabel?: string;
  color?: string;
}) {
  return (
    <Card>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="p-2 rounded-lg bg-gray-50">
            <Icon className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {(subtitle || trend !== undefined) && (
          <div className="flex items-center gap-2 mt-1">
            {trend !== undefined && trend !== null && (
              <span
                className={`flex items-center text-xs font-medium ${
                  trend >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {trend >= 0 ? (
                  <ArrowTrendingUpIcon className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowTrendingDownIcon className="w-3 h-3 mr-0.5" />
                )}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
            {(subtitle || trendLabel) && (
              <span className="text-xs text-gray-500">
                {subtitle || trendLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function KPIDashboardPage() {
  const { fc } = useCurrency();
  const { activeCompany } = useAppStore();
  const [asOfDate, setAsOfDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kpi-report', asOfDate],
    queryFn: () =>
      api.get<KPIResponse>(`/api/v1/reports/kpi?asOfDate=${asOfDate}`),
  });

  const kpis: KPIData | null = (data as any)?.kpis ?? null;
  const fiscalYearStart = (data as any)?.fiscalYearStart;

  const fmtRatio = (v: number | null) =>
    v !== null ? v.toFixed(2) + 'x' : 'N/A';
  const fmtDays = (v: number | null) =>
    v !== null ? v + ' days' : 'N/A';
  const fmtPct = (v: number) => v.toFixed(1) + '%';

  const handlePrint = () => {
    if (!kpis) return;
    const currency = (data as any)?.currency ?? 'JMD';
    const revenueStats = generateStatCards([
      { label: 'Revenue (This Month)', value: formatPrintCurrency(kpis.revenueCurrentMonth, currency) },
      { label: 'Revenue (YTD)', value: formatPrintCurrency(kpis.revenueYTD, currency) },
      { label: 'Revenue (Last Month)', value: formatPrintCurrency(kpis.revenuePrevMonth, currency) },
      { label: 'MoM Growth', value: fmtPct(kpis.revenueGrowthMoM) },
    ]);
    const profitabilityStats = generateStatCards([
      { label: 'Gross Margin (Month)', value: fmtPct(kpis.grossMarginCurrentMonth) },
      { label: 'Gross Margin (YTD)', value: fmtPct(kpis.grossMarginYTD) },
      { label: 'Net Margin (Month)', value: fmtPct(kpis.netMarginCurrentMonth) },
      { label: 'Net Margin (YTD)', value: fmtPct(kpis.netMarginYTD) },
    ]);
    const liquidityStats = generateStatCards([
      { label: 'Cash on Hand', value: formatPrintCurrency(kpis.cashOnHand, currency) },
      { label: 'Current Ratio', value: fmtRatio(kpis.currentRatio) },
      { label: 'Quick Ratio', value: fmtRatio(kpis.quickRatio) },
      { label: 'Cash Runway', value: kpis.cashRunwayMonths !== null ? `${kpis.cashRunwayMonths} months` : 'N/A' },
    ]);
    const efficiencyStats = generateStatCards([
      { label: 'AR Days (DSO)', value: fmtDays(kpis.arDays) },
      { label: 'AP Days (DPO)', value: fmtDays(kpis.apDays) },
      { label: 'Open Invoices', value: kpis.openInvoices.toString() },
      { label: 'Payroll % of Revenue', value: fmtPct(kpis.payrollPercentOfRevenue) },
    ]);
    const content = `
      <h3 style="margin-top:20px;margin-bottom:10px;color:#059669;">Revenue</h3>${revenueStats}
      <h3 style="margin-top:20px;margin-bottom:10px;color:#3b82f6;">Profitability</h3>${profitabilityStats}
      <h3 style="margin-top:20px;margin-bottom:10px;color:#8b5cf6;">Liquidity</h3>${liquidityStats}
      <h3 style="margin-top:20px;margin-bottom:10px;color:#f97316;">Efficiency</h3>${efficiencyStats}
    `;
    printContent({
      title: 'KPI Dashboard',
      subtitle: `As of ${asOfDate}`,
      companyName: activeCompany?.businessName,
      companyTrn: activeCompany?.trnNumber,
      content,
    });
  };

  const handleExportCSV = () => {
    if (!kpis) return;
    downloadAsCSV([
      { KPI: 'Revenue (This Month)', Value: kpis.revenueCurrentMonth },
      { KPI: 'Revenue (YTD)', Value: kpis.revenueYTD },
      { KPI: 'Revenue (Last Month)', Value: kpis.revenuePrevMonth },
      { KPI: 'MoM Growth %', Value: kpis.revenueGrowthMoM },
      { KPI: 'Gross Margin (Month) %', Value: kpis.grossMarginCurrentMonth },
      { KPI: 'Gross Margin (YTD) %', Value: kpis.grossMarginYTD },
      { KPI: 'Net Margin (Month) %', Value: kpis.netMarginCurrentMonth },
      { KPI: 'Net Margin (YTD) %', Value: kpis.netMarginYTD },
      { KPI: 'Cash on Hand', Value: kpis.cashOnHand },
      { KPI: 'Current Ratio', Value: kpis.currentRatio ?? 'N/A' },
      { KPI: 'Quick Ratio', Value: kpis.quickRatio ?? 'N/A' },
      { KPI: 'Cash Runway (Months)', Value: kpis.cashRunwayMonths ?? 'N/A' },
      { KPI: 'AR Days (DSO)', Value: kpis.arDays ?? 'N/A' },
      { KPI: 'AP Days (DPO)', Value: kpis.apDays ?? 'N/A' },
      { KPI: 'Open Invoices', Value: kpis.openInvoices },
      { KPI: 'Overdue Invoices', Value: kpis.overdueInvoices },
      { KPI: 'Monthly Burn Rate', Value: kpis.monthlyBurnRate },
      { KPI: 'Payroll Cost (YTD)', Value: kpis.payrollCostYTD },
      { KPI: 'Payroll % of Revenue', Value: kpis.payrollPercentOfRevenue },
      { KPI: 'Total Employees', Value: kpis.totalEmployees },
    ], `kpi-dashboard-${asOfDate}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI Dashboard</h1>
          <p className="text-gray-500">
            Key financial performance indicators
            {fiscalYearStart && (
              <span className="ml-1 text-xs">
                (FY from {fiscalYearStart})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">
              As of:
            </label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
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
      {kpis && (
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800 flex-1">
            Failed to load KPI data.{' '}
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
            <p className="text-gray-500">Calculating KPIs...</p>
          </div>
        </Card>
      )}

      {kpis && (
        <>
          {/* Revenue Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-emerald-500" />
              Revenue
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Revenue (This Month)"
                value={fc(kpis.revenueCurrentMonth)}
                icon={CurrencyDollarIcon}
                trend={kpis.revenueGrowthMoM}
                trendLabel="vs last month"
                color="text-emerald-700"
              />
              <KPICard
                title="Revenue (YTD)"
                value={fc(kpis.revenueYTD)}
                icon={ChartBarIcon}
                color="text-emerald-700"
              />
              <KPICard
                title="Revenue (Last Month)"
                value={fc(kpis.revenuePrevMonth)}
                icon={CurrencyDollarIcon}
              />
              <KPICard
                title="MoM Growth"
                value={fmtPct(kpis.revenueGrowthMoM)}
                icon={ArrowTrendingUpIcon}
                color={
                  kpis.revenueGrowthMoM >= 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }
              />
            </div>
          </div>

          {/* Profitability Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-blue-500" />
              Profitability
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Gross Margin (Month)"
                value={fmtPct(kpis.grossMarginCurrentMonth)}
                subtitle={`Gross Profit: ${fc(kpis.grossProfitCurrentMonth)}`}
                icon={ChartBarIcon}
                color={
                  kpis.grossMarginCurrentMonth >= 0
                    ? 'text-blue-700'
                    : 'text-red-700'
                }
              />
              <KPICard
                title="Gross Margin (YTD)"
                value={fmtPct(kpis.grossMarginYTD)}
                subtitle={`Gross Profit: ${fc(kpis.grossProfitYTD)}`}
                icon={ChartBarIcon}
                color={
                  kpis.grossMarginYTD >= 0
                    ? 'text-blue-700'
                    : 'text-red-700'
                }
              />
              <KPICard
                title="Net Margin (Month)"
                value={fmtPct(kpis.netMarginCurrentMonth)}
                subtitle={`Net Income: ${fc(kpis.netIncomeCurrentMonth)}`}
                icon={CalculatorIcon}
                color={
                  kpis.netMarginCurrentMonth >= 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }
              />
              <KPICard
                title="Net Margin (YTD)"
                value={fmtPct(kpis.netMarginYTD)}
                subtitle={`Net Income: ${fc(kpis.netIncomeYTD)}`}
                icon={CalculatorIcon}
                color={
                  kpis.netMarginYTD >= 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }
              />
            </div>
          </div>

          {/* Liquidity Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <BanknotesIcon className="w-5 h-5 text-purple-500" />
              Liquidity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Cash on Hand"
                value={fc(kpis.cashOnHand)}
                icon={BanknotesIcon}
                color="text-purple-700"
              />
              <KPICard
                title="Current Ratio"
                value={fmtRatio(kpis.currentRatio)}
                subtitle="Current Assets / Current Liabilities"
                icon={CalculatorIcon}
                color={
                  kpis.currentRatio !== null && kpis.currentRatio >= 1
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }
              />
              <KPICard
                title="Quick Ratio"
                value={fmtRatio(kpis.quickRatio)}
                subtitle="(Current Assets - Inventory) / Current Liabilities"
                icon={CalculatorIcon}
                color={
                  kpis.quickRatio !== null && kpis.quickRatio >= 1
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
              />
              <KPICard
                title="Cash Runway"
                value={
                  kpis.cashRunwayMonths !== null
                    ? `${kpis.cashRunwayMonths} months`
                    : 'N/A'
                }
                subtitle={`Burn rate: ${fc(kpis.monthlyBurnRate)}/mo`}
                icon={ClockIcon}
                color={
                  kpis.cashRunwayMonths !== null && kpis.cashRunwayMonths >= 6
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
              />
            </div>
          </div>

          {/* Efficiency Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-orange-500" />
              Efficiency
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="AR Days (DSO)"
                value={fmtDays(kpis.arDays)}
                subtitle={`Outstanding: ${fc(kpis.totalAR)}`}
                icon={ClockIcon}
                color={
                  kpis.arDays !== null && kpis.arDays <= 30
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
              />
              <KPICard
                title="AP Days (DPO)"
                value={fmtDays(kpis.apDays)}
                subtitle={`Payable: ${fc(kpis.totalAP)}`}
                icon={ClockIcon}
              />
              <KPICard
                title="Open Invoices"
                value={kpis.openInvoices.toString()}
                subtitle={`${kpis.overdueInvoices} overdue`}
                icon={DocumentTextIcon}
                color={
                  kpis.overdueInvoices > 0 ? 'text-red-700' : 'text-gray-900'
                }
              />
              <KPICard
                title="Payroll % of Revenue"
                value={fmtPct(kpis.payrollPercentOfRevenue)}
                subtitle={`${kpis.totalEmployees} employees | YTD: ${fc(kpis.payrollCostYTD)}`}
                icon={UserGroupIcon}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
