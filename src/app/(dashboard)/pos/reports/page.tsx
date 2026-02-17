'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, Button, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { usePosStore } from '@/store/posStore';
import { useAppStore } from '@/store/appStore';
import { formatJMD } from '@/lib/utils';
import { printContent, generateTable, generateStatCards, formatPrintCurrency } from '@/lib/print';
import type { ZReport, PosSession } from '@/types/pos';
import {
  ArrowLeftIcon,
  DocumentChartBarIcon,
  PrinterIcon,
  ClockIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function POSReportsPage() {
  const [selectedSession, setSelectedSession] = useState<PosSession | null>(null);
  const [showXReportModal, setShowXReportModal] = useState(false);
  const [xReportData, setXReportData] = useState<XReportData | null>(null);

  const { sessions, zReports, generateZReport, getOrdersBySession } = usePosStore();
  const activeCompany = useAppStore((state) => state.activeCompany);

  // Get closed sessions that don't have a Z-report yet
  const closedSessions = sessions.filter(s => s.status === 'closed');
  const openSessions = sessions.filter(s => s.status === 'open');

  interface XReportData {
    session: PosSession;
    transactionCount: number;
    grossSales: number;
    discounts: number;
    netSales: number;
    gctCollected: number;
    cashOnHand: number;
    paymentBreakdown: { method: string; count: number; total: number }[];
  }

  const generateXReport = (session: PosSession) => {
    const orders = getOrdersBySession(session.id);
    const completedOrders = orders.filter(o => o.status === 'completed');

    const grossSales = completedOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const discounts = completedOrders.reduce((sum, o) => sum + o.orderDiscountAmount, 0);
    const netSales = grossSales - discounts;
    const gctCollected = completedOrders.reduce((sum, o) => sum + o.gctAmount, 0);

    const paymentMap = new Map<string, { count: number; total: number }>();
    completedOrders.forEach(order => {
      order.payments
        .filter(p => p.status === 'completed')
        .forEach(payment => {
          const existing = paymentMap.get(payment.method) || { count: 0, total: 0 };
          paymentMap.set(payment.method, {
            count: existing.count + 1,
            total: existing.total + payment.amount,
          });
        });
    });

    const data: XReportData = {
      session,
      transactionCount: completedOrders.length,
      grossSales,
      discounts,
      netSales,
      gctCollected,
      cashOnHand: session.expectedCash,
      paymentBreakdown: Array.from(paymentMap.entries()).map(([method, data]) => ({
        method: method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count: data.count,
        total: data.total,
      })),
    };

    setXReportData(data);
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

  const handlePrintZReport = (report: ZReport) => {
    const summaryContent = generateStatCards([
      { label: 'Total Transactions', value: String(report.totalTransactions) },
      { label: 'Gross Sales', value: formatPrintCurrency(report.grossSales), color: '#059669' },
      { label: 'Discounts', value: formatPrintCurrency(report.discounts), color: '#dc2626' },
      { label: 'Net Sales', value: formatPrintCurrency(report.netSales), color: '#16a34a' },
    ]);

    const paymentTable = report.paymentBreakdown.length > 0
      ? generateTable(
          [
            { key: 'methodLabel', label: 'Payment Method' },
            { key: 'transactionCount', label: 'Count', align: 'right' },
            { key: 'total', label: 'Total', align: 'right' },
          ],
          report.paymentBreakdown,
          { formatters: { total: formatPrintCurrency } }
        )
      : '<p>No payments recorded</p>';

    const cashSection = `
      <h3 style="margin: 20px 0 10px; font-weight: 600;">Cash Reconciliation</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;color:#6b7280;">Opening Cash</td><td style="padding:8px;font-weight:500;text-align:right;">${formatPrintCurrency(report.openingCash)}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Cash Sales</td><td style="padding:8px;font-weight:500;text-align:right;">${formatPrintCurrency(report.cashSales)}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Cash Refunds</td><td style="padding:8px;font-weight:500;text-align:right;">(${formatPrintCurrency(report.cashRefunds)})</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Cash Payouts</td><td style="padding:8px;font-weight:500;text-align:right;">(${formatPrintCurrency(report.cashPayouts)})</td></tr>
        <tr style="border-top:1px solid #e5e7eb;"><td style="padding:8px;font-weight:600;">Expected Cash</td><td style="padding:8px;font-weight:700;text-align:right;">${formatPrintCurrency(report.expectedCash)}</td></tr>
        <tr><td style="padding:8px;font-weight:600;">Actual Cash</td><td style="padding:8px;font-weight:700;text-align:right;">${formatPrintCurrency(report.actualCash)}</td></tr>
        <tr style="background:${report.variance === 0 ? '#f0fdf4' : '#fef2f2'};"><td style="padding:8px;font-weight:600;">Variance</td><td style="padding:8px;font-weight:700;text-align:right;color:${report.variance === 0 ? '#16a34a' : '#dc2626'};">${report.variance >= 0 ? '+' : ''}${formatPrintCurrency(report.variance)}</td></tr>
      </table>
    `;

    const taxSection = `
      <h3 style="margin: 20px 0 10px; font-weight: 600;">Tax Summary</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;color:#6b7280;">Taxable Sales</td><td style="padding:8px;font-weight:500;text-align:right;">${formatPrintCurrency(report.taxableAmount)}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Exempt Sales</td><td style="padding:8px;font-weight:500;text-align:right;">${formatPrintCurrency(report.exemptAmount)}</td></tr>
        <tr style="border-top:1px solid #e5e7eb;"><td style="padding:8px;font-weight:600;">GCT Collected</td><td style="padding:8px;font-weight:700;text-align:right;">${formatPrintCurrency(report.gctCollected)}</td></tr>
      </table>
    `;

    const content = `
      ${summaryContent}
      <h3 style="margin: 20px 0 10px; font-weight: 600;">Payment Breakdown</h3>
      ${paymentTable}
      ${cashSection}
      ${taxSection}
    `;

    printContent({
      title: 'Z-Report (End of Day)',
      subtitle: `${report.reportNumber} | ${format(new Date(report.date), 'MMM dd, yyyy')}`,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  const handleGenerateZReport = (session: PosSession) => {
    if (!confirm('Generate Z-Report for this session? This is typically done at end of day.')) return;
    const report = generateZReport(session.id, 'Current User');
    handlePrintZReport(report);
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
              {openSessions.map(session => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="font-medium text-gray-900">{session.terminalName}</p>
                    <p className="text-sm text-gray-500">
                      Opened: {format(new Date(session.openedAt), 'MMM dd, yyyy HH:mm')} | Cashier: {session.cashierName}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => generateXReport(session)}>
                    <DocumentChartBarIcon className="w-4 h-4 mr-2" />
                    Generate X-Report
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Closed Sessions (Z-Reports) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ReceiptPercentIcon className="w-5 h-5 text-emerald-600" />
            <CardTitle>Closed Sessions (Z-Report)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {closedSessions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No closed sessions</p>
          ) : (
            <div className="space-y-3">
              {closedSessions.map(session => {
                const existingReport = zReports.find(r =>
                  r.terminalId === session.terminalId &&
                  new Date(r.periodStart).getTime() === new Date(session.openedAt).getTime()
                );

                return (
                  <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="font-medium text-gray-900">{session.terminalName}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(session.openedAt), 'MMM dd, yyyy HH:mm')} - {session.closedAt ? format(new Date(session.closedAt), 'HH:mm') : ''}
                      </p>
                      <p className="text-sm text-gray-600">
                        Sales: {formatJMD(session.netSales)} | Orders: {session.orderIds.length}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {existingReport ? (
                        <Button variant="outline" onClick={() => handlePrintZReport(existingReport)}>
                          <PrinterIcon className="w-4 h-4 mr-2" />
                          Print Z-Report
                        </Button>
                      ) : (
                        <Button onClick={() => handleGenerateZReport(session)}>
                          <DocumentChartBarIcon className="w-4 h-4 mr-2" />
                          Generate Z-Report
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Z-Report History */}
      <Card>
        <CardHeader>
          <CardTitle>Z-Report History</CardTitle>
        </CardHeader>
        <CardContent>
          {zReports.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No Z-Reports generated yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50">
                    <th className="px-4 py-3 font-medium">Report #</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Terminal</th>
                    <th className="px-4 py-3 font-medium text-right">Transactions</th>
                    <th className="px-4 py-3 font-medium text-right">Net Sales</th>
                    <th className="px-4 py-3 font-medium text-right">GCT</th>
                    <th className="px-4 py-3 font-medium text-right">Variance</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {zReports.map(report => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{report.reportNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{format(new Date(report.date), 'MMM dd, yyyy')}</td>
                      <td className="px-4 py-3 text-gray-600">{report.terminalName}</td>
                      <td className="px-4 py-3 text-right">{report.completedTransactions}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatJMD(report.netSales)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatJMD(report.gctCollected)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 ${report.variance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {report.variance === 0 ? (
                            <CheckCircleIcon className="w-4 h-4" />
                          ) : (
                            <ExclamationTriangleIcon className="w-4 h-4" />
                          )}
                          {report.variance >= 0 ? '+' : ''}{formatJMD(report.variance)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => handlePrintZReport(report)}>
                          <PrinterIcon className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* X-Report Modal */}
      <Modal
        isOpen={showXReportModal}
        onClose={() => setShowXReportModal(false)}
        title="X-Report (Mid-Day)"
        size="lg"
      >
        <ModalBody>
          {xReportData && (
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
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowXReportModal(false)}>Close</Button>
          <Button onClick={handlePrintXReport}>
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
