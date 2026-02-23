'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, Button, Modal, ModalBody, ModalFooter } from '@/components/ui';
import {
  usePosSessions,
  usePosOrders,
  useClosePosSession,
  type ApiPosSession,
} from '@/hooks/api/usePos';
import { useAppStore } from '@/store/appStore';
import { formatJMD } from '@/lib/utils';
import { printContent, generateTable, generateStatCards, formatPrintCurrency } from '@/lib/print';
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
} from '@heroicons/react/24/outline';

export default function POSReportsPage() {
  const [showXReportModal, setShowXReportModal] = useState(false);
  const [xReportSessionId, setXReportSessionId] = useState<string | null>(null);

  // Fetch open and closed sessions from API
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

  // Fetch completed orders for the selected session (X-report)
  const {
    data: sessionOrdersData,
    isLoading: ordersLoading,
  } = usePosOrders(
    xReportSessionId
      ? { sessionId: xReportSessionId, limit: 100 }
      : { limit: 0 }
  );

  const activeCompany = useAppStore((state) => state.activeCompany);

  const openSessions = openSessionsData?.data ?? [];
  const closedSessions = closedSessionsData?.data ?? [];

  // Compute X-report data from session orders
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

    // Payment breakdown from order payments
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
      { label: 'Gross Sales', value: formatPrintCurrency(xReportData.grossSales), color: '#059669' },
      { label: 'Discounts', value: formatPrintCurrency(xReportData.discounts), color: '#dc2626' },
      { label: 'Net Sales', value: formatPrintCurrency(xReportData.netSales), color: '#16a34a' },
    ]);

    const paymentTable = xReportData.paymentBreakdown.length > 0
      ? generateTable(
          [
            { key: 'method', label: 'Payment Method' },
            { key: 'count', label: 'Count', align: 'right' },
            { key: 'total', label: 'Total', align: 'right' },
          ],
          xReportData.paymentBreakdown,
          { formatters: { total: formatPrintCurrency } }
        )
      : '<p>No payments recorded yet</p>';

    const content = `
      ${summaryContent}
      <h3 style="margin: 20px 0 10px; font-weight: 600;">Payment Breakdown</h3>
      ${paymentTable}
      <div style="margin-top: 20px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
        <p><strong>GCT Collected:</strong> ${formatPrintCurrency(xReportData.gctCollected)}</p>
        <p><strong>Expected Cash on Hand:</strong> ${formatPrintCurrency(xReportData.cashOnHand)}</p>
      </div>
    `;

    printContent({
      title: 'X-Report (Mid-Day)',
      subtitle: `Session: ${xReportData.session.terminalName} | ${format(new Date(xReportData.session.openedAt), 'MMM dd, yyyy HH:mm')}`,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  const isLoading = openLoading || closedLoading;
  const hasError = openError || closedError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">POS Reports</h1>
            <p className="text-gray-500">X-Reports (mid-day) and Z-Reports (end of day)</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">POS Reports</h1>
            <p className="text-gray-500">X-Reports (mid-day) and Z-Reports (end of day)</p>
          </div>
        </div>
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-gray-700 font-medium mb-2">Failed to load reports data</p>
              <p className="text-gray-500 text-sm">Please try refreshing the page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">POS Reports</h1>
          <p className="text-gray-500">X-Reports (mid-day) and Z-Reports (end of day)</p>
        </div>
      </div>

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
            <p className="text-gray-500 text-center py-8">No active sessions</p>
          ) : (
            <div className="space-y-3">
              {openSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="font-medium text-gray-900">{session.terminalName}</p>
                    <p className="text-sm text-gray-500">
                      Opened: {format(new Date(session.openedAt), 'MMM dd, yyyy HH:mm')} | Cashier: {session.cashierName}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => handleGenerateXReport(session)}>
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
            <CardTitle>Closed Sessions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {closedSessions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No closed sessions</p>
          ) : (
            <div className="space-y-3">
              {closedSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">{session.terminalName}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(session.openedAt), 'MMM dd, yyyy HH:mm')} - {session.closedAt ? format(new Date(session.closedAt), 'HH:mm') : ''}
                    </p>
                    <p className="text-sm text-gray-600">
                      Sales: {formatJMD(Number(session.netSales))} | Orders: {session._count?.orders ?? 0}
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
                            Variance: {Number(session.cashVariance) >= 0 ? '+' : ''}{formatJMD(Number(session.cashVariance))}
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
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  This is a mid-day snapshot report. The session remains open for more transactions.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{xReportData.transactionCount}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Gross Sales</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatJMD(xReportData.grossSales)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Discounts</p>
                  <p className="text-2xl font-bold text-red-600">{formatJMD(xReportData.discounts)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Net Sales</p>
                  <p className="text-2xl font-bold text-gray-900">{formatJMD(xReportData.netSales)}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Payment Breakdown</h3>
                {xReportData.paymentBreakdown.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50">
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2 text-right">Count</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {xReportData.paymentBreakdown.map((p, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">{p.method}</td>
                          <td className="px-3 py-2 text-right">{p.count}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatJMD(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500">No payments recorded yet</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                  <p className="text-sm text-emerald-700">GCT Collected</p>
                  <p className="text-xl font-bold text-emerald-800">{formatJMD(xReportData.gctCollected)}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">Expected Cash on Hand</p>
                  <p className="text-xl font-bold text-blue-800">{formatJMD(xReportData.cashOnHand)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
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
