'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, ModalBody, ModalFooter } from '@/components/ui';
import {
  usePosSessions,
  usePosOrders,
  useDailySalesReport,
  useProductPerformanceReport,
  type ApiPosSession,
  type DailySalesHour,
} from '@/hooks/api/usePos';
import { useAppStore } from '@/store/appStore';
import { printContent, generateTable, generateStatCards } from '@/lib/print';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import {
  ArrowLeftIcon,
  DocumentChartBarIcon,
  PrinterIcon,
  ClockIcon,
  ReceiptPercentIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  CubeIcon,
  CalendarDaysIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  ShoppingCartIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

// ---- Tab types ----
type ReportTab = 'sessions' | 'daily-sales' | 'product-performance';

const TABS: { id: ReportTab; label: string; icon: React.ElementType }[] = [
  { id: 'sessions', label: 'X / Z Reports', icon: ReceiptPercentIcon },
  { id: 'daily-sales', label: 'Daily Sales', icon: ChartBarIcon },
  { id: 'product-performance', label: 'Product Performance', icon: CubeIcon },
];

export default function POSReportsPage() {
  const { fc, fcp } = useCurrency();
  const [activeTab, setActiveTab] = useState<ReportTab>('sessions');
  const [showXReportModal, setShowXReportModal] = useState(false);
  const [xReportSessionId, setXReportSessionId] = useState<string | null>(null);

  // Daily sales state
  const [dailySalesDate, setDailySalesDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );

  // Product performance state
  const [perfFrom, setPerfFrom] = useState(
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [perfTo, setPerfTo] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );

  // ---- Sessions data (X/Z Reports) ----
  const {
    data: openSessionsData,
    isLoading: openLoading,
    error: openError,
  } = usePosSessions({ status: 'OPEN', limit: 50 });

  const {
    data: closedSessionsData,
    isLoading: closedLoading,
    error: closedError,
  } = usePosSessions({ status: 'CLOSED', limit: 50 });

  const {
    data: sessionOrdersData,
    isLoading: ordersLoading,
  } = usePosOrders(
    xReportSessionId
      ? { sessionId: xReportSessionId, limit: 100 }
      : { limit: 0 }
  );

  // ---- Daily sales data ----
  const {
    data: dailySalesData,
    isLoading: dailySalesLoading,
    error: dailySalesError,
  } = useDailySalesReport(activeTab === 'daily-sales' ? dailySalesDate : null);

  // ---- Product performance data ----
  const {
    data: perfData,
    isLoading: perfLoading,
    error: perfError,
  } = useProductPerformanceReport(
    activeTab === 'product-performance' ? { from: perfFrom, to: perfTo } : null
  );

  const activeCompany = useAppStore((state) => state.activeCompany);

  const openSessions = openSessionsData?.data ?? [];
  const closedSessions = closedSessionsData?.data ?? [];

  // ---- X-Report computation ----
  const xReportData = useMemo(() => {
    if (!xReportSessionId || !sessionOrdersData?.data) return null;
    const session = openSessions.find((s) => s.id === xReportSessionId);
    if (!session) return null;

    const orders = sessionOrdersData.data;
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');

    const grossSales = completedOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const discounts = completedOrders.reduce((sum, o) => sum + Number(o.orderDiscountAmount), 0);
    const netSales = grossSales - discounts;
    const gctCollected = completedOrders.reduce((sum, o) => sum + Number(o.gctAmount), 0);

    const paymentMap = new Map<string, { count: number; total: number }>();
    completedOrders.forEach((order) => {
      (order.payments ?? [])
        .filter((p) => p.status === 'COMPLETED')
        .forEach((payment) => {
          const method = payment.method;
          const existing = paymentMap.get(method) || { count: 0, total: 0 };
          paymentMap.set(method, {
            count: existing.count + 1,
            total: existing.total + Number(payment.amount),
          });
        });
    });

    const paymentBreakdown = Array.from(paymentMap.entries()).map(([method, data]) => ({
      method: method.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      count: data.count,
      total: data.total,
    }));

    return {
      session,
      transactionCount: completedOrders.length,
      grossSales,
      discounts,
      netSales,
      gctCollected,
      cashOnHand: Number(session.expectedCash),
      paymentBreakdown,
    };
  }, [xReportSessionId, sessionOrdersData, openSessions]);

  const handleGenerateXReport = (session: ApiPosSession) => {
    setXReportSessionId(session.id);
    setShowXReportModal(true);
  };

  const handlePrintXReport = () => {
    if (!xReportData) return;

    const summaryContent = generateStatCards([
      { label: 'Transactions', value: String(xReportData.transactionCount) },
      { label: 'Gross Sales', value: fcp(xReportData.grossSales), color: '#059669' },
      { label: 'Discounts', value: fcp(xReportData.discounts), color: '#dc2626' },
      { label: 'Net Sales', value: fcp(xReportData.netSales), color: '#16a34a' },
    ]);

    const paymentTable = xReportData.paymentBreakdown.length > 0
      ? generateTable(
          [
            { key: 'method', label: 'Payment Method' },
            { key: 'count', label: 'Count', align: 'right' },
            { key: 'total', label: 'Total', align: 'right' },
          ],
          xReportData.paymentBreakdown,
          { formatters: { total: fcp } }
        )
      : '<p>No payments recorded yet</p>';

    const content = `
      ${summaryContent}
      <h3 style="margin: 20px 0 10px; font-weight: 600;">Payment Breakdown</h3>
      ${paymentTable}
      <div style="margin-top: 20px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
        <p><strong>GCT Collected:</strong> ${fcp(xReportData.gctCollected)}</p>
        <p><strong>Expected Cash on Hand:</strong> ${fcp(xReportData.cashOnHand)}</p>
      </div>
    `;

    printContent({
      title: 'X-Report (Mid-Day)',
      subtitle: `Session: ${xReportData.session.terminalName} | ${format(new Date(xReportData.session.openedAt), 'MMM dd, yyyy HH:mm')}`,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  // ---- Hourly chart bar helpers ----
  const maxHourlyTotal = useMemo(() => {
    if (!dailySalesData?.salesByHour) return 1;
    return Math.max(...dailySalesData.salesByHour.map((h) => h.total), 1);
  }, [dailySalesData]);

  const sessionsLoading = openLoading || closedLoading;
  const sessionsError = openError || closedError;

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">POS Reports</h1>
          <p className="text-gray-500 dark:text-gray-400">Sales analytics, product performance, and session reports</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group inline-flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive ? 'text-emerald-500' : 'text-gray-400 group-hover:text-gray-500')} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'sessions' && (
        <SessionsTab
          openSessions={openSessions}
          closedSessions={closedSessions}
          isLoading={sessionsLoading}
          hasError={!!sessionsError}
          onGenerateXReport={handleGenerateXReport}
          fc={fc}
        />
      )}

      {activeTab === 'daily-sales' && (
        <DailySalesTab
          date={dailySalesDate}
          onDateChange={setDailySalesDate}
          data={dailySalesData ?? null}
          isLoading={dailySalesLoading}
          hasError={!!dailySalesError}
          fc={fc}
          maxHourlyTotal={maxHourlyTotal}
        />
      )}

      {activeTab === 'product-performance' && (
        <ProductPerformanceTab
          from={perfFrom}
          to={perfTo}
          onFromChange={setPerfFrom}
          onToChange={setPerfTo}
          data={perfData ?? null}
          isLoading={perfLoading}
          hasError={!!perfError}
          fc={fc}
        />
      )}

      {/* X-Report Modal */}
      <Modal
        isOpen={showXReportModal}
        onClose={() => { setShowXReportModal(false); setXReportSessionId(null); }}
        title="X-Report (Mid-Day)"
        size="lg"
      >
        <ModalBody>
          {ordersLoading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : xReportData ? (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  This is a mid-day snapshot report. The session remains open for more transactions.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{xReportData.transactionCount}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Gross Sales</p>
                  <p className="text-2xl font-bold text-emerald-600">{fc(xReportData.grossSales)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Discounts</p>
                  <p className="text-2xl font-bold text-red-600">{fc(xReportData.discounts)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Net Sales</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{fc(xReportData.netSales)}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Payment Breakdown</h3>
                {xReportData.paymentBreakdown.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2 text-right">Count</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {xReportData.paymentBreakdown.map((p, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">{p.method}</td>
                          <td className="px-3 py-2 text-right">{p.count}</td>
                          <td className="px-3 py-2 text-right font-medium">{fc(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No payments recorded yet</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">GCT Collected</p>
                  <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{fc(xReportData.gctCollected)}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-400">Expected Cash on Hand</p>
                  <p className="text-xl font-bold text-blue-800 dark:text-blue-300">{fc(xReportData.cashOnHand)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setShowXReportModal(false); setXReportSessionId(null); }}>Close</Button>
          <Button onClick={handlePrintXReport} disabled={!xReportData}>
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}


// ============================================================
// Sessions Tab (X / Z Reports) — extracted from original page
// ============================================================

function SessionsTab({
  openSessions,
  closedSessions,
  isLoading,
  hasError,
  onGenerateXReport,
  fc,
}: {
  openSessions: ApiPosSession[];
  closedSessions: ApiPosSession[];
  isLoading: boolean;
  hasError: boolean;
  onGenerateXReport: (session: ApiPosSession) => void;
  fc: (amount: number) => string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (hasError) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">Failed to load session data</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Please try refreshing the page.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Open Sessions (X-Reports) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-blue-600" />
            <CardTitle>Active Sessions (X-Report)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {openSessions.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No active sessions</p>
          ) : (
            <div className="space-y-3">
              {openSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{session.terminalName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Opened: {format(new Date(session.openedAt), 'MMM dd, yyyy HH:mm')} | Cashier: {session.cashierName}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => onGenerateXReport(session)}>
                    <DocumentChartBarIcon className="w-4 h-4 mr-2" />
                    Generate X-Report
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Closed Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ReceiptPercentIcon className="w-5 h-5 text-emerald-600" />
            <CardTitle>Closed Sessions (Z-Reports)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {closedSessions.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No closed sessions</p>
          ) : (
            <div className="space-y-3">
              {closedSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{session.terminalName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(session.openedAt), 'MMM dd, yyyy HH:mm')} - {session.closedAt ? format(new Date(session.closedAt), 'HH:mm') : ''}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Sales: {fc(Number(session.netSales))} | Orders: {session._count?.orders ?? 0}
                    </p>
                    {session.cashVariance !== null && session.cashVariance !== undefined && (
                      <p className={`text-sm ${Number(session.cashVariance) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(session.cashVariance) === 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircleIcon className="w-4 h-4" />
                            No variance
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <ExclamationTriangleIcon className="w-4 h-4" />
                            Variance: {Number(session.cashVariance) >= 0 ? '+' : ''}{fc(Number(session.cashVariance))}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// ============================================================
// Daily Sales Tab
// ============================================================

function DailySalesTab({
  date,
  onDateChange,
  data,
  isLoading,
  hasError,
  fc,
  maxHourlyTotal,
}: {
  date: string;
  onDateChange: (d: string) => void;
  data: import('@/hooks/api/usePos').DailySalesReport | null;
  isLoading: boolean;
  hasError: boolean;
  fc: (amount: number) => string;
  maxHourlyTotal: number;
}) {
  return (
    <div className="space-y-6">
      {/* Date picker */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-4 py-2">
            <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Report Date:</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      )}

      {hasError && (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">Failed to load daily sales data</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Please try a different date or refresh the page.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !hasError && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <SummaryCard
              icon={ShoppingCartIcon}
              label="Orders"
              value={String(data.summary.orderCount)}
              color="gray"
            />
            <SummaryCard
              icon={BanknotesIcon}
              label="Gross Sales"
              value={fc(data.summary.grossSales)}
              color="emerald"
            />
            <SummaryCard
              icon={TagIcon}
              label="Discounts"
              value={fc(data.summary.discounts)}
              color="red"
            />
            <SummaryCard
              icon={ArrowTrendingUpIcon}
              label="Net Sales"
              value={fc(data.summary.netSales)}
              color="emerald"
            />
            <SummaryCard
              icon={ReceiptPercentIcon}
              label="GCT Collected"
              value={fc(data.summary.gctCollected)}
              color="blue"
            />
            <SummaryCard
              icon={ChartBarIcon}
              label="Avg Transaction"
              value={fc(data.summary.avgTransaction)}
              color="gray"
            />
          </div>

          {/* Sales by hour */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-emerald-600" />
                <CardTitle>Sales by Hour</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {data.summary.orderCount === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No sales recorded for this date</p>
              ) : (
                <div className="space-y-1">
                  {data.salesByHour
                    .filter((h) => h.orderCount > 0)
                    .map((h) => (
                    <HourlyBar
                      key={h.hour}
                      hour={h}
                      maxTotal={maxHourlyTotal}
                      fc={fc}
                    />
                  ))}
                  {data.salesByHour.every((h) => h.orderCount === 0) && (
                    <p className="text-gray-500 text-center py-4">No sales activity</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Products side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Quantity */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CubeIcon className="w-5 h-5 text-blue-600" />
                  <CardTitle>Top 10 Products (by Quantity)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {data.topProductsByQty.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No products sold</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                          <th className="px-3 py-2 w-8">#</th>
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data.topProductsByQty.map((p) => (
                          <tr key={p.rank} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-3 py-2 text-gray-400 dark:text-gray-500 font-medium">{p.rank}</td>
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{p.name}</td>
                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{p.quantity}</td>
                            <td className="px-3 py-2 text-right font-medium text-emerald-600">{fc(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Revenue */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BanknotesIcon className="w-5 h-5 text-emerald-600" />
                  <CardTitle>Top 10 Products (by Revenue)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {data.topProductsByRev.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No products sold</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                          <th className="px-3 py-2 w-8">#</th>
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2 text-right">Revenue</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data.topProductsByRev.map((p) => (
                          <tr key={p.rank} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-3 py-2 text-gray-400 dark:text-gray-500 font-medium">{p.rank}</td>
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{p.name}</td>
                            <td className="px-3 py-2 text-right font-medium text-emerald-600">{fc(p.revenue)}</td>
                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{p.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Method Breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BanknotesIcon className="w-5 h-5 text-emerald-600" />
                <CardTitle>Payment Method Breakdown</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {data.paymentBreakdown.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No payments recorded</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2 text-right">Transactions</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">% of Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {data.paymentBreakdown.map((p) => {
                        const pct = data.summary.netSales > 0
                          ? ((p.total / data.summary.netSales) * 100).toFixed(1)
                          : '0.0';
                        return (
                          <tr key={p.method} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p.methodLabel}</td>
                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{p.count}</td>
                            <td className="px-3 py-2 text-right font-medium text-emerald-600">{fc(p.total)}</td>
                            <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-900 font-semibold">
                        <td className="px-3 py-2 text-gray-900 dark:text-white">Total</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                          {data.paymentBreakdown.reduce((s, p) => s + p.count, 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-700">
                          {fc(data.paymentBreakdown.reduce((s, p) => s + p.total, 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}


// ============================================================
// Product Performance Tab
// ============================================================

function ProductPerformanceTab({
  from,
  to,
  onFromChange,
  onToChange,
  data,
  isLoading,
  hasError,
  fc,
}: {
  from: string;
  to: string;
  onFromChange: (d: string) => void;
  onToChange: (d: string) => void;
  data: import('@/hooks/api/usePos').ProductPerformanceReport | null;
  isLoading: boolean;
  hasError: boolean;
  fc: (amount: number) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 py-2">
            <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From:</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              className="w-48"
            />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To:</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      )}

      {hasError && (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">Failed to load product performance data</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Please try adjusting the date range or refreshing.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !hasError && data && (
        <>
          {/* Product Sales Ranking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-600" />
                  <CardTitle>Product Sales Ranking</CardTitle>
                </div>
                <Badge variant="outline">{data.products.length} products</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {data.products.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No product sales in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                        <th className="px-3 py-2 w-8">#</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 text-right">Qty Sold</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                        <th className="px-3 py-2 text-right">Cost</th>
                        <th className="px-3 py-2 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {data.products.map((p, idx) => (
                        <tr key={p.productId ?? p.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-3 py-2 text-gray-400 dark:text-gray-500 font-medium">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white truncate max-w-[250px]">{p.name}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{p.quantitySold}</td>
                          <td className="px-3 py-2 text-right font-medium text-emerald-600">{fc(p.revenue)}</td>
                          <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">
                            {p.totalCost > 0 ? fc(p.totalCost) : '--'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {p.profitMargin !== null ? (
                              <span className={cn(
                                'font-medium',
                                p.profitMargin >= 30 ? 'text-emerald-600' :
                                p.profitMargin >= 15 ? 'text-yellow-600' :
                                'text-red-600'
                              )}>
                                {p.profitMargin.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alerts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                  <CardTitle>Low Stock Alerts</CardTitle>
                </div>
                {data.lowStockAlerts.length > 0 && (
                  <Badge variant="warning">{data.lowStockAlerts.length} items</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {data.lowStockAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircleIcon className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">All products are above reorder levels</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No restocking action needed at this time.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2 text-right">Current Stock</th>
                        <th className="px-3 py-2 text-right">Reorder Level</th>
                        <th className="px-3 py-2 text-right">Deficit</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {data.lowStockAlerts.map((p) => {
                        const isOutOfStock = p.currentStock <= 0;
                        return (
                          <tr key={p.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-700', isOutOfStock && 'bg-red-50 dark:bg-red-900/30')}>
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p.name}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">{p.sku}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.category ?? '--'}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              <span className={isOutOfStock ? 'text-red-600' : 'text-amber-600'}>
                                {p.currentStock}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{p.reorderLevel}</td>
                            <td className="px-3 py-2 text-right text-red-600 font-medium">{p.deficit}</td>
                            <td className="px-3 py-2 text-right">
                              {isOutOfStock ? (
                                <Badge variant="danger">Out of Stock</Badge>
                              ) : (
                                <Badge variant="warning">Low Stock</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}


// ============================================================
// Shared helper components
// ============================================================

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'emerald' | 'red' | 'blue' | 'gray';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    red: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    gray: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300',
  };

  const iconColors = {
    emerald: 'text-emerald-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
    gray: 'text-gray-400',
  };

  return (
    <div className={cn('rounded-lg border p-4', colorClasses[color])}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', iconColors[color])} />
        <p className="text-xs font-medium uppercase tracking-wider opacity-75">{label}</p>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function HourlyBar({
  hour,
  maxTotal,
  fc,
}: {
  hour: DailySalesHour;
  maxTotal: number;
  fc: (amount: number) => string;
}) {
  const pct = maxTotal > 0 ? (hour.total / maxTotal) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-12 flex-shrink-0">{hour.label}</span>
      <div className="flex-1 h-7 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden relative">
        <div
          className="h-full bg-emerald-500 rounded transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
        {hour.orderCount > 0 && (
          <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-700 dark:text-gray-300">
            {hour.orderCount} order{hour.orderCount !== 1 ? 's' : ''} &middot; {fc(hour.total)}
          </span>
        )}
      </div>
    </div>
  );
}
