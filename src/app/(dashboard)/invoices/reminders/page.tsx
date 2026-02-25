'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { api } from '@/lib/api-client';
import {
  BellAlertIcon,
  BellSnoozeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

// --------------------------------------------------
// Types for demo reminder data
// --------------------------------------------------

interface ReminderHistoryEntry {
  invoiceId: string;
  sentAt: Date;
  method: 'email' | 'sms';
  status: 'delivered' | 'failed' | 'pending';
}

interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  invoiceNumber: string;
  customerName: string;
  method: 'email' | 'sms' | 'system';
  status: 'success' | 'failed' | 'info';
}

interface ReminderScheduleDay {
  days: number;
  enabled: boolean;
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function getDaysOverdue(dueDate: Date | string): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getUrgencyLevel(daysOverdue: number): 'low' | 'medium' | 'high' {
  if (daysOverdue <= 30) return 'low';
  if (daysOverdue <= 60) return 'medium';
  return 'high';
}

function getUrgencyStyles(level: 'low' | 'medium' | 'high') {
  switch (level) {
    case 'low':
      return {
        border: 'border-l-4 border-l-yellow-400',
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        badgeVariant: 'warning' as const,
        label: '1-30 days',
      };
    case 'medium':
      return {
        border: 'border-l-4 border-l-orange-400',
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        badgeVariant: 'warning' as const,
        label: '31-60 days',
      };
    case 'high':
      return {
        border: 'border-l-4 border-l-red-500',
        bg: 'bg-red-50',
        text: 'text-red-700',
        badgeVariant: 'danger' as const,
        label: '60+ days',
      };
  }
}

// --------------------------------------------------
// Page Component
// --------------------------------------------------

export default function PaymentRemindersPage() {
  const { fc } = useCurrency();
  const { invoices, customers, activeCompany } = useAppStore();
  const today = new Date();

  // Settings state
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(true);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const [reminderSchedule, setReminderSchedule] = useState<ReminderScheduleDay[]>([
    { days: 7, enabled: true },
    { days: 14, enabled: true },
    { days: 30, enabled: true },
    { days: 60, enabled: false },
  ]);

  // Find overdue invoices from the store
  const overdueInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (activeCompany && inv.companyId !== activeCompany.id) return false;
      if (inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'draft') return false;

      const isExplicitlyOverdue = inv.status === 'overdue';
      const isPastDueAndSent =
        inv.status === 'sent' && new Date(inv.dueDate) < today;

      return isExplicitlyOverdue || isPastDueAndSent;
    });
  }, [invoices, activeCompany, today]);

  // Demo reminder history keyed by invoice ID
  const [reminderHistory] = useState<Record<string, ReminderHistoryEntry[]>>(() => {
    const history: Record<string, ReminderHistoryEntry[]> = {};
    overdueInvoices.forEach((inv, index) => {
      if (index % 3 !== 0) {
        // Give ~2/3 of invoices some reminder history
        const daysAgo = Math.floor(Math.random() * 14) + 1;
        const sentDate = new Date();
        sentDate.setDate(sentDate.getDate() - daysAgo);
        history[inv.id] = [
          {
            invoiceId: inv.id,
            sentAt: sentDate,
            method: 'email',
            status: 'delivered',
          },
        ];
        // Some invoices get a second reminder
        if (index % 2 === 0) {
          const olderDate = new Date();
          olderDate.setDate(olderDate.getDate() - daysAgo - 14);
          history[inv.id].push({
            invoiceId: inv.id,
            sentAt: olderDate,
            method: 'email',
            status: 'delivered',
          });
        }
      }
    });
    return history;
  });

  // Demo activity log
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(() => {
    const log: ActivityLogEntry[] = [];
    const actions = [
      'Payment reminder sent',
      'Auto-reminder triggered',
      'Reminder email delivered',
      'Follow-up reminder sent',
      'Reminder email bounced',
    ];
    overdueInvoices.slice(0, 5).forEach((inv, index) => {
      const customer = inv.customer || customers.find((c) => c.id === inv.customerId);
      const daysAgo = index + 1;
      const logDate = new Date();
      logDate.setDate(logDate.getDate() - daysAgo);
      log.push({
        id: `log-${index}`,
        timestamp: logDate,
        action: actions[index % actions.length],
        invoiceNumber: inv.invoiceNumber,
        customerName: customer?.name || 'Unknown Customer',
        method: index === 4 ? 'system' : 'email',
        status: index === 4 ? 'failed' : 'success',
      });
    });
    // Add a couple of system entries
    const systemDate = new Date();
    systemDate.setDate(systemDate.getDate() - 1);
    log.push({
      id: 'log-system-1',
      timestamp: systemDate,
      action: 'Auto-reminder schedule updated',
      invoiceNumber: '-',
      customerName: 'System',
      method: 'system',
      status: 'info',
    });
    return log;
  });

  // Stats
  const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const remindersSentThisMonth = activityLog.filter(
    (entry) => entry.timestamp >= startOfMonth && entry.status === 'success'
  ).length;

  // Get last reminder info for an invoice
  function getLastReminderInfo(invoiceId: string): string {
    const history = reminderHistory[invoiceId];
    if (!history || history.length === 0) return 'Never reminded';
    const sorted = [...history].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    const lastSent = sorted[0];
    const daysAgo = Math.floor(
      (today.getTime() - new Date(lastSent.sentAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysAgo === 0) return 'Last reminded: Today';
    if (daysAgo === 1) return 'Last reminded: Yesterday';
    return `Last reminded: ${daysAgo} days ago`;
  }

  function getReminderCount(invoiceId: string): number {
    return reminderHistory[invoiceId]?.length || 0;
  }

  // Send a real payment reminder via the API
  async function handleSendReminder(invoiceId: string) {
    setSendingIds((prev) => new Set(prev).add(invoiceId));

    const inv = invoices.find((i) => i.id === invoiceId);
    const customer = inv?.customer || customers.find((c) => c.id === inv?.customerId);

    try {
      await api.post('/api/v1/invoices/reminders', {
        invoiceIds: [invoiceId],
      });

      const newLogEntry: ActivityLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date(),
        action: 'Payment reminder sent',
        invoiceNumber: inv?.invoiceNumber || 'Unknown',
        customerName: customer?.name || 'Unknown Customer',
        method: 'email',
        status: 'success',
      };
      setActivityLog((prev) => [newLogEntry, ...prev]);
    } catch (err: any) {
      const newLogEntry: ActivityLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date(),
        action: 'Reminder email failed',
        invoiceNumber: inv?.invoiceNumber || 'Unknown',
        customerName: customer?.name || 'Unknown Customer',
        method: 'email',
        status: 'failed',
      };
      setActivityLog((prev) => [newLogEntry, ...prev]);
    }

    setSendingIds((prev) => {
      const next = new Set(prev);
      next.delete(invoiceId);
      return next;
    });
  }

  // Send all reminders
  async function handleSendAllReminders() {
    setSendingAll(true);
    for (const inv of overdueInvoices) {
      await handleSendReminder(inv.id);
    }
    setSendingAll(false);
  }

  // Toggle schedule day
  function toggleScheduleDay(index: number) {
    setReminderSchedule((prev) =>
      prev.map((item, i) => (i === index ? { ...item, enabled: !item.enabled } : item))
    );
  }

  // Sort overdue invoices by days overdue (most urgent first)
  const sortedOverdueInvoices = useMemo(() => {
    return [...overdueInvoices].sort((a, b) => {
      const daysA = getDaysOverdue(a.dueDate);
      const daysB = getDaysOverdue(b.dueDate);
      return daysB - daysA;
    });
  }, [overdueInvoices]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Reminders</h1>
          <p className="text-gray-500">Track and send payment reminders for overdue invoices</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            icon={<Cog6ToothIcon className="w-4 h-4" />}
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </Button>
          <Button
            icon={<PaperAirplaneIcon className="w-4 h-4" />}
            onClick={handleSendAllReminders}
            loading={sendingAll}
            disabled={overdueInvoices.length === 0}
          >
            Send All Reminders
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Overdue Invoices</p>
                <p className="text-2xl font-bold text-red-600">{overdueInvoices.length}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CurrencyDollarIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Overdue Amount</p>
                <p className="text-2xl font-bold text-orange-600">{fc(totalOverdueAmount)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <EnvelopeIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Reminders Sent This Month</p>
                <p className="text-2xl font-bold text-blue-600">{remindersSentThisMonth}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                {autoRemindersEnabled ? (
                  <BellAlertIcon className="w-5 h-5 text-emerald-600" />
                ) : (
                  <BellSnoozeIcon className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Auto-reminders</p>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => setAutoRemindersEnabled(!autoRemindersEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoRemindersEnabled ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoRemindersEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-semibold ${autoRemindersEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {autoRemindersEnabled ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Reminder Settings (collapsible) */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle>Reminder Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Schedule */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Reminder Schedule</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Configure when automatic reminders are sent after the due date.
                </p>
                <div className="space-y-3">
                  {reminderSchedule.map((item, index) => (
                    <div
                      key={item.days}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        item.enabled ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleScheduleDay(index)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            item.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              item.enabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.days} days after due date
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.enabled ? 'Reminder will be sent automatically' : 'Disabled'}
                          </p>
                        </div>
                      </div>
                      <ClockIcon className={`w-4 h-4 ${item.enabled ? 'text-emerald-500' : 'text-gray-300'}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Email Template Preview */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Email Template Preview</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Preview of the reminder email that will be sent to customers.
                </p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                    <p className="text-xs text-gray-500">Subject: Payment Reminder - Invoice #INV-XXXX</p>
                  </div>
                  <div className="p-4 text-sm text-gray-700 space-y-3 bg-white">
                    <p>Dear <span className="text-emerald-600 font-medium">[Customer Name]</span>,</p>
                    <p>
                      This is a friendly reminder that payment for invoice{' '}
                      <span className="font-semibold">#INV-XXXX</span> in the amount of{' '}
                      <span className="font-semibold text-emerald-600">[Amount]</span> was due on{' '}
                      <span className="font-semibold">[Due Date]</span>.
                    </p>
                    <p>
                      The invoice is now <span className="text-red-600 font-semibold">[X] days overdue</span>.
                      We kindly request that you arrange payment at your earliest convenience.
                    </p>
                    <p>
                      If you have already made this payment, please disregard this notice. Otherwise,
                      please do not hesitate to contact us if you have any questions.
                    </p>
                    <p className="pt-2 border-t border-gray-100">
                      Best regards,
                      <br />
                      <span className="font-medium">{activeCompany?.businessName || 'Your Business'}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Invoices List */}
      <Card padding="none">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Overdue Invoices</h3>
              <p className="text-sm text-gray-500 mt-1">
                {overdueInvoices.length === 0
                  ? 'No overdue invoices found'
                  : `${overdueInvoices.length} invoice${overdueInvoices.length !== 1 ? 's' : ''} require attention`}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                1-30 days
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-orange-400" />
                31-60 days
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                60+ days
              </div>
            </div>
          </div>
        </div>

        {sortedOverdueInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircleIcon className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">All caught up!</p>
            <p className="text-sm text-gray-400 mt-1">No overdue invoices at the moment.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedOverdueInvoices.map((invoice) => {
              const customer = invoice.customer || customers.find((c) => c.id === invoice.customerId);
              const daysOverdue = getDaysOverdue(invoice.dueDate);
              const urgency = getUrgencyLevel(daysOverdue);
              const styles = getUrgencyStyles(urgency);
              const reminderInfo = getLastReminderInfo(invoice.id);
              const reminderCount = getReminderCount(invoice.id);
              const isSending = sendingIds.has(invoice.id);

              return (
                <div
                  key={invoice.id}
                  className={`p-4 sm:p-6 ${styles.border} hover:bg-gray-50 transition-colors`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left side - Invoice info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {customer?.name || 'Unknown Customer'}
                        </h4>
                        <Badge variant={styles.badgeVariant} size="sm">
                          {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span className="font-medium text-gray-700">{invoice.invoiceNumber}</span>
                        <span>{fc(invoice.balance)}</span>
                        <span>Due: {formatDate(invoice.dueDate)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" />
                          {reminderInfo}
                        </span>
                        {reminderCount > 0 && (
                          <span className="text-xs text-gray-400">
                            ({reminderCount} reminder{reminderCount !== 1 ? 's' : ''} sent)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side - Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<EnvelopeIcon className="w-4 h-4" />}
                        onClick={() => handleSendReminder(invoice.id)}
                        loading={isSending}
                        disabled={isSending}
                      >
                        Send Reminder
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>
            <button
              className="flex items-center gap-2 hover:text-gray-600 transition-colors"
              onClick={() => setShowActivityLog(!showActivityLog)}
            >
              Recent Reminder Activity
              {showActivityLog ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
          </CardTitle>
        </CardHeader>
        {showActivityLog && (
          <CardContent>
            {activityLog.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {activityLog.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-b-0"
                  >
                    {/* Icon */}
                    <div
                      className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                        entry.status === 'success'
                          ? 'bg-emerald-100'
                          : entry.status === 'failed'
                          ? 'bg-red-100'
                          : 'bg-blue-100'
                      }`}
                    >
                      {entry.status === 'success' ? (
                        <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                      ) : entry.status === 'failed' ? (
                        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-600" />
                      ) : (
                        <ArrowPathIcon className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {entry.action}
                        {entry.invoiceNumber !== '-' && (
                          <>
                            {' '}for{' '}
                            <span className="font-medium">{entry.invoiceNumber}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {entry.customerName} &middot;{' '}
                        {entry.method === 'email' ? 'Email' : entry.method === 'sms' ? 'SMS' : 'System'}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-gray-400 shrink-0">
                      {formatRelativeTimestamp(entry.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// --------------------------------------------------
// Local helper (not exported from utils, kept local)
// --------------------------------------------------

function formatRelativeTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}
