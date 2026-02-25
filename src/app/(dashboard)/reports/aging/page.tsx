'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { printContent, generateTable, downloadAsCSV } from '@/lib/print';

// ============================================
// TYPES
// ============================================

type AgingTab = 'ar' | 'ap';

interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

interface AgingLineItem {
  id: string;
  reference: string;
  date: string;
  dueDate: string;
  amount: number;
  balance: number;
  daysOverdue: number;
  bucket: keyof Omit<AgingBuckets, 'total'>;
}

interface AgingGroup {
  id: string;
  name: string;
  buckets: AgingBuckets;
  items: AgingLineItem[];
}

// ============================================
// HELPERS
// ============================================

function getDaysOverdue(dueDate: Date | string): number {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = today.getTime() - due.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getBucket(daysOverdue: number): keyof Omit<AgingBuckets, 'total'> {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'days1to30';
  if (daysOverdue <= 60) return 'days31to60';
  if (daysOverdue <= 90) return 'days61to90';
  return 'days90plus';
}

function emptyBuckets(): AgingBuckets {
  return { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 };
}

function getBucketBadge(bucket: keyof Omit<AgingBuckets, 'total'>) {
  switch (bucket) {
    case 'current':
      return { variant: 'success' as const, label: 'Current' };
    case 'days1to30':
      return { variant: 'warning' as const, label: '1-30 Days' };
    case 'days31to60':
      return { variant: 'warning' as const, label: '31-60 Days' };
    case 'days61to90':
      return { variant: 'danger' as const, label: '61-90 Days' };
    case 'days90plus':
      return { variant: 'danger' as const, label: '90+ Days' };
  }
}

// ============================================
// COMPONENT
// ============================================

export default function AgingReportPage() {
  const { fc, fcp } = useCurrency();
  const [activeTab, setActiveTab] = useState<AgingTab>('ar');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { invoices, expenses, customers, activeCompany } = useAppStore();

  // ---- AR Aging Data ----
  const arData = useMemo(() => {
    const unpaidInvoices = invoices.filter(
      (inv) => inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft'
    );

    const groupMap = new Map<string, AgingGroup>();

    for (const inv of unpaidInvoices) {
      const customer = customers.find((c) => c.id === inv.customerId);
      const customerName = customer?.name || inv.customer?.name || 'Unknown Customer';
      const customerId = inv.customerId;

      if (!groupMap.has(customerId)) {
        groupMap.set(customerId, {
          id: customerId,
          name: customerName,
          buckets: emptyBuckets(),
          items: [],
        });
      }

      const group = groupMap.get(customerId)!;
      const daysOverdue = getDaysOverdue(inv.dueDate);
      const bucket = getBucket(daysOverdue);
      const balance = inv.balance > 0 ? inv.balance : inv.total - inv.amountPaid;

      group.buckets[bucket] += balance;
      group.buckets.total += balance;

      group.items.push({
        id: inv.id,
        reference: inv.invoiceNumber,
        date: typeof inv.issueDate === 'string' ? inv.issueDate : new Date(inv.issueDate).toISOString(),
        dueDate: typeof inv.dueDate === 'string' ? inv.dueDate : new Date(inv.dueDate).toISOString(),
        amount: inv.total,
        balance,
        daysOverdue: Math.max(0, daysOverdue),
        bucket,
      });
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => b.buckets.total - a.buckets.total);

    const totals = groups.reduce(
      (acc, g) => {
        acc.current += g.buckets.current;
        acc.days1to30 += g.buckets.days1to30;
        acc.days31to60 += g.buckets.days31to60;
        acc.days61to90 += g.buckets.days61to90;
        acc.days90plus += g.buckets.days90plus;
        acc.total += g.buckets.total;
        return acc;
      },
      emptyBuckets()
    );

    return { groups, totals };
  }, [invoices, customers]);

  // ---- AP Aging Data ----
  const apData = useMemo(() => {
    const groupMap = new Map<string, AgingGroup>();

    for (const exp of expenses) {
      const vendor = exp.vendorId ? customers.find((c) => c.id === exp.vendorId) : null;
      const groupName = vendor?.name || exp.category || 'Uncategorized';
      const groupId = exp.vendorId || `cat-${exp.category}`;

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          id: groupId,
          name: groupName,
          buckets: emptyBuckets(),
          items: [],
        });
      }

      const group = groupMap.get(groupId)!;
      const daysOverdue = getDaysOverdue(exp.date);
      const bucket = getBucket(daysOverdue);

      group.buckets[bucket] += exp.amount;
      group.buckets.total += exp.amount;

      group.items.push({
        id: exp.id,
        reference: exp.reference || exp.description,
        date: typeof exp.date === 'string' ? exp.date : new Date(exp.date).toISOString(),
        dueDate: typeof exp.date === 'string' ? exp.date : new Date(exp.date).toISOString(),
        amount: exp.amount,
        balance: exp.amount,
        daysOverdue: Math.max(0, daysOverdue),
        bucket,
      });
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => b.buckets.total - a.buckets.total);

    const totals = groups.reduce(
      (acc, g) => {
        acc.current += g.buckets.current;
        acc.days1to30 += g.buckets.days1to30;
        acc.days31to60 += g.buckets.days31to60;
        acc.days61to90 += g.buckets.days61to90;
        acc.days90plus += g.buckets.days90plus;
        acc.total += g.buckets.total;
        return acc;
      },
      emptyBuckets()
    );

    return { groups, totals };
  }, [expenses, customers]);

  const data = activeTab === 'ar' ? arData : apData;

  // ---- Expand / Collapse ----
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ---- Print ----
  const handlePrint = () => {
    const title = activeTab === 'ar' ? 'Accounts Receivable Aging' : 'Accounts Payable Aging';
    const entityLabel = activeTab === 'ar' ? 'Customer' : 'Vendor / Category';

    const content = generateTable(
      [
        { key: 'name', label: entityLabel },
        { key: 'current', label: 'Current', align: 'right' },
        { key: 'days1to30', label: '1-30 Days', align: 'right' },
        { key: 'days31to60', label: '31-60 Days', align: 'right' },
        { key: 'days61to90', label: '61-90 Days', align: 'right' },
        { key: 'days90plus', label: '90+ Days', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
      data.groups.map((g) => ({
        name: g.name,
        current: g.buckets.current,
        days1to30: g.buckets.days1to30,
        days31to60: g.buckets.days31to60,
        days61to90: g.buckets.days61to90,
        days90plus: g.buckets.days90plus,
        total: g.buckets.total,
      })),
      {
        formatters: {
          current: fcp,
          days1to30: fcp,
          days31to60: fcp,
          days61to90: fcp,
          days90plus: fcp,
          total: fcp,
        },
        summaryRow: {
          name: 'Grand Total',
          current: data.totals.current,
          days1to30: data.totals.days1to30,
          days31to60: data.totals.days31to60,
          days61to90: data.totals.days61to90,
          days90plus: data.totals.days90plus,
          total: data.totals.total,
        },
      }
    );

    printContent({
      title,
      subtitle: `As of ${formatDate(new Date())}`,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  // ---- Download CSV ----
  const handleDownload = () => {
    const entityLabel = activeTab === 'ar' ? 'Customer' : 'Vendor / Category';
    const filename = activeTab === 'ar' ? 'ar-aging-report' : 'ap-aging-report';

    const rows = data.groups.map((g) => ({
      [entityLabel]: g.name,
      Current: g.buckets.current,
      '1-30 Days': g.buckets.days1to30,
      '31-60 Days': g.buckets.days31to60,
      '61-90 Days': g.buckets.days61to90,
      '90+ Days': g.buckets.days90plus,
      Total: g.buckets.total,
    }));

    rows.push({
      [entityLabel]: 'Grand Total',
      Current: data.totals.current,
      '1-30 Days': data.totals.days1to30,
      '31-60 Days': data.totals.days31to60,
      '61-90 Days': data.totals.days61to90,
      '90+ Days': data.totals.days90plus,
      Total: data.totals.total,
    });

    downloadAsCSV(rows, filename);
  };

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aging Report</h1>
          <p className="text-gray-500">
            Outstanding balances by aging period as of {formatDate(new Date())}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setActiveTab('ar'); setExpandedRows(new Set()); }}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ar'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Accounts Receivable
        </button>
        <button
          onClick={() => { setActiveTab('ap'); setExpandedRows(new Set()); }}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ap'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Accounts Payable
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{fc(data.totals.current)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">1-30 Days</p>
            <p className="text-lg font-bold text-yellow-600 mt-1">{fc(data.totals.days1to30)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">31-60 Days</p>
            <p className="text-lg font-bold text-orange-500 mt-1">{fc(data.totals.days31to60)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">61-90 Days</p>
            <p className="text-lg font-bold text-orange-600 mt-1">{fc(data.totals.days61to90)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">90+ Days</p>
            <p className="text-lg font-bold text-red-600 mt-1">{fc(data.totals.days90plus)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{fc(data.totals.total)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Table */}
      <Card padding="none">
        <CardHeader className="px-6 pt-6">
          <CardTitle>
            {activeTab === 'ar' ? 'Receivables by Customer' : 'Payables by Vendor / Category'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.groups.length === 0 ? (
            <div className="px-6 pb-6">
              <p className="text-gray-500 text-center py-12">
                {activeTab === 'ar'
                  ? 'No outstanding receivables found.'
                  : 'No outstanding payables found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-6 font-semibold text-gray-600 w-8"></th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">
                      {activeTab === 'ar' ? 'Customer' : 'Vendor / Category'}
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">Current</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">1-30 Days</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">31-60 Days</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">61-90 Days</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">90+ Days</th>
                    <th className="text-right py-3 px-6 font-semibold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((group) => (
                    <React.Fragment key={group.id}>
                      {/* Group Row */}
                      <tr
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleRow(group.id)}
                      >
                        <td className="py-3 px-6">
                          {expandedRows.has(group.id) ? (
                            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{group.name}</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {group.buckets.current > 0 ? fc(group.buckets.current) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {group.buckets.days1to30 > 0 ? (
                            <span className="text-yellow-600">{fc(group.buckets.days1to30)}</span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {group.buckets.days31to60 > 0 ? (
                            <span className="text-orange-500">{fc(group.buckets.days31to60)}</span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {group.buckets.days61to90 > 0 ? (
                            <span className="text-orange-600">{fc(group.buckets.days61to90)}</span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {group.buckets.days90plus > 0 ? (
                            <span className="text-red-600 font-medium">{fc(group.buckets.days90plus)}</span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-6 text-right font-semibold tabular-nums text-gray-900">
                          {fc(group.buckets.total)}
                        </td>
                      </tr>

                      {/* Expanded Detail Rows */}
                      {expandedRows.has(group.id) && group.items.map((item) => {
                        const badgeInfo = getBucketBadge(item.bucket);
                        return (
                          <tr
                            key={item.id}
                            className="border-b border-gray-50 bg-gray-50/50"
                          >
                            <td className="py-2 px-6"></td>
                            <td className="py-2 px-4 pl-10">
                              <div className="flex items-center gap-3">
                                <span className="text-gray-600 text-xs font-mono">{item.reference}</span>
                                <Badge variant={badgeInfo.variant} size="sm">
                                  {badgeInfo.label}
                                </Badge>
                                {item.daysOverdue > 0 && (
                                  <span className="text-xs text-gray-400">
                                    {item.daysOverdue} {item.daysOverdue === 1 ? 'day' : 'days'} overdue
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-4 mt-1 text-xs text-gray-400">
                                <span>Date: {formatDate(item.date)}</span>
                                <span>Due: {formatDate(item.dueDate)}</span>
                                {item.amount !== item.balance && (
                                  <span>Invoice Total: {fc(item.amount)}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums text-gray-500">
                              {item.bucket === 'current' ? fc(item.balance) : '-'}
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums text-gray-500">
                              {item.bucket === 'days1to30' ? fc(item.balance) : '-'}
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums text-gray-500">
                              {item.bucket === 'days31to60' ? fc(item.balance) : '-'}
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums text-gray-500">
                              {item.bucket === 'days61to90' ? fc(item.balance) : '-'}
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums text-gray-500">
                              {item.bucket === 'days90plus' ? fc(item.balance) : '-'}
                            </td>
                            <td className="py-2 px-6 text-right tabular-nums text-gray-600 font-medium">
                              {fc(item.balance)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}

                  {/* Grand Total Row */}
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td className="py-4 px-6"></td>
                    <td className="py-4 px-4 font-bold text-gray-900">Grand Total</td>
                    <td className="py-4 px-4 text-right font-bold tabular-nums text-emerald-600">
                      {fc(data.totals.current)}
                    </td>
                    <td className="py-4 px-4 text-right font-bold tabular-nums text-yellow-600">
                      {fc(data.totals.days1to30)}
                    </td>
                    <td className="py-4 px-4 text-right font-bold tabular-nums text-orange-500">
                      {fc(data.totals.days31to60)}
                    </td>
                    <td className="py-4 px-4 text-right font-bold tabular-nums text-orange-600">
                      {fc(data.totals.days61to90)}
                    </td>
                    <td className="py-4 px-4 text-right font-bold tabular-nums text-red-600">
                      {fc(data.totals.days90plus)}
                    </td>
                    <td className="py-4 px-6 text-right font-bold tabular-nums text-gray-900">
                      {fc(data.totals.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
