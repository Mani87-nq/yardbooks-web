'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, ModalBody, ModalFooter, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useCustomers } from '@/hooks/api';
import { formatJMD, formatDate } from '@/lib/utils';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
type RecurringStatus = 'active' | 'paused' | 'expired';

interface RecurringInvoice {
  id: string;
  customerName: string;
  customerId: string;
  description: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  nextInvoiceDate: string;
  status: RecurringStatus;
  createdAt: string;
  invoicesGenerated: number;
}

// ============================================
// CONSTANTS
// ============================================

const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const STATUS_BADGE_MAP: Record<RecurringStatus, { variant: 'success' | 'warning' | 'default'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  paused: { variant: 'warning', label: 'Paused' },
  expired: { variant: 'default', label: 'Expired' },
};

// ============================================
// HELPERS
// ============================================

function getMonthlyEquivalent(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'weekly':
      return amount * 4.33;
    case 'biweekly':
      return amount * 2.17;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
  }
}

function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

// ============================================
// COMPONENT
// ============================================

export default function RecurringInvoicesPage() {
  // Fetch customers from API for dropdown
  const { data: customersResponse } = useCustomers({ limit: 200 });
  const customers = (customersResponse as any)?.data ?? [];

  // API-driven state
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<RecurringInvoice | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formFrequency, setFormFrequency] = useState<Frequency>('monthly');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

  const fetchRecurringInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<{ data: RecurringInvoice[] } | RecurringInvoice[]>('/api/v1/recurring-invoices');
      const list = Array.isArray(data) ? data : (data as any).data ?? [];
      setRecurringInvoices(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load recurring invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecurringInvoices();
  }, [fetchRecurringInvoices]);

  // Computed data
  const filteredInvoices = useMemo(() => {
    return recurringInvoices.filter((ri) => {
      const matchesSearch =
        !searchQuery ||
        ri.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ri.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || ri.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [recurringInvoices, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const activeInvoices = recurringInvoices.filter((ri) => ri.status === 'active');
    const dueThisWeek = activeInvoices.filter((ri) => isWithinDays(ri.nextInvoiceDate, 7));
    const monthlyRevenue = activeInvoices.reduce(
      (sum, ri) => sum + getMonthlyEquivalent(ri.amount, ri.frequency),
      0
    );

    return {
      totalActive: activeInvoices.length,
      dueThisWeek: dueThisWeek.length,
      monthlyRevenue,
    };
  }, [recurringInvoices]);

  // Customer options for the form dropdown
  const customerOptions = useMemo(() => {
    const storeCustomers = customers.map((c: any) => ({ value: c.name, label: c.name }));
    if (storeCustomers.length === 0) {
      return [{ value: '', label: 'Select a customer...' }];
    }
    return [{ value: '', label: 'Select a customer...' }, ...storeCustomers];
  }, [customers]);

  // Actions
  const resetForm = () => {
    setFormCustomerName('');
    setFormDescription('');
    setFormAmount('');
    setFormFrequency('monthly');
    setFormStartDate('');
    setFormEndDate('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setEditingInvoice(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (invoice: RecurringInvoice) => {
    setEditingInvoice(invoice);
    setFormCustomerName(invoice.customerName);
    setFormDescription(invoice.description);
    setFormAmount(invoice.amount.toString());
    setFormFrequency(invoice.frequency);
    setFormStartDate(invoice.startDate);
    setFormEndDate(invoice.endDate || '');
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formCustomerName || !formDescription || !formAmount || !formStartDate) {
      return;
    }

    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSaving(true);
    try {
      const payload = {
        customerName: formCustomerName,
        description: formDescription,
        amount,
        frequency: formFrequency,
        startDate: formStartDate,
        endDate: formEndDate || null,
      };

      if (editingInvoice) {
        await api.put(`/api/v1/recurring-invoices/${editingInvoice.id}`, payload);
      } else {
        await api.post('/api/v1/recurring-invoices', payload);
      }

      setShowCreateModal(false);
      resetForm();
      setEditingInvoice(null);
      fetchRecurringInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to save recurring invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    const invoice = recurringInvoices.find((ri) => ri.id === id);
    if (!invoice) return;
    try {
      await api.put(`/api/v1/recurring-invoices/${id}`, {
        status: invoice.status === 'active' ? 'paused' : 'active',
      });
      fetchRecurringInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/v1/recurring-invoices/${id}`);
      setShowDeleteConfirm(null);
      fetchRecurringInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to delete recurring invoice');
    }
  };

  const statuses = ['all', 'active', 'paused', 'expired'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Loading recurring invoices...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-600">{error}</p>
        <Button onClick={fetchRecurringInvoices}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Invoices</h1>
          <p className="text-gray-500">Manage automated invoice templates</p>
        </div>
        <Button icon={<PlusIcon className="w-4 h-4" />} onClick={handleOpenCreate}>
          New Recurring Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ArrowPathIcon className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Active</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalActive}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Due This Week</p>
              <p className="text-2xl font-bold text-blue-600">{stats.dueThisWeek}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
              <BanknotesIcon className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monthly Revenue</p>
              <p className="text-2xl font-bold text-orange-600">{formatJMD(stats.monthlyRevenue)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search recurring invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Recurring Invoice Cards */}
      {filteredInvoices.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recurring invoices found</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Create your first recurring invoice to automate your billing.'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button icon={<PlusIcon className="w-4 h-4" />} onClick={handleOpenCreate}>
                Create Recurring Invoice
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredInvoices.map((invoice) => {
            const badgeConfig = STATUS_BADGE_MAP[invoice.status];
            const isDueThisWeek = invoice.status === 'active' && isWithinDays(invoice.nextInvoiceDate, 7);

            return (
              <Card key={invoice.id} padding="none">
                <div className="p-6">
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {invoice.customerName}
                        </h3>
                        <Badge variant={badgeConfig.variant}>{badgeConfig.label}</Badge>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{invoice.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-lg font-bold text-gray-900">{formatJMD(invoice.amount)}</p>
                      <p className="text-xs text-gray-400">/{FREQUENCY_LABELS[invoice.frequency].toLowerCase()}</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-0.5">Frequency</p>
                      <p className="text-sm font-medium text-gray-700">{FREQUENCY_LABELS[invoice.frequency]}</p>
                    </div>
                    <div className={`rounded-lg p-3 ${isDueThisWeek ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      <p className="text-xs text-gray-400 mb-0.5">Next Invoice</p>
                      <p className={`text-sm font-medium ${isDueThisWeek ? 'text-blue-700' : 'text-gray-700'}`}>
                        {formatDate(invoice.nextInvoiceDate)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-0.5">Start Date</p>
                      <p className="text-sm font-medium text-gray-700">{formatDate(invoice.startDate)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-0.5">Invoices Sent</p>
                      <p className="text-sm font-medium text-gray-700">{invoice.invoicesGenerated}</p>
                    </div>
                  </div>

                  {/* End date note */}
                  {invoice.endDate && (
                    <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-400">
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span>Ends {formatDate(invoice.endDate)}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                    {invoice.status !== 'expired' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(invoice.id)}
                        icon={
                          invoice.status === 'active' ? (
                            <PauseIcon className="w-4 h-4" />
                          ) : (
                            <PlayIcon className="w-4 h-4" />
                          )
                        }
                      >
                        {invoice.status === 'active' ? 'Pause' : 'Resume'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(invoice)}
                      icon={<PencilIcon className="w-4 h-4" />}
                    >
                      Edit
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setShowDeleteConfirm(invoice.id)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingInvoice(null);
          resetForm();
        }}
        title={editingInvoice ? 'Edit Recurring Invoice' : 'New Recurring Invoice'}
        description={
          editingInvoice
            ? 'Update the recurring invoice template details.'
            : 'Set up an automated recurring invoice for a customer.'
        }
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            <Select
              label="Customer"
              options={customerOptions}
              value={formCustomerName}
              onChange={(e) => setFormCustomerName(e.target.value)}
            />
            <Input
              label="Description"
              placeholder="e.g., Monthly website hosting"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amount (J$)"
                type="number"
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                min="0"
                step="0.01"
              />
              <Select
                label="Frequency"
                options={FREQUENCY_OPTIONS}
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as Frequency)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
              <Input
                label="End Date (Optional)"
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                hint="Leave blank for no end date"
              />
            </div>

            {formAmount && formFrequency && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <p className="text-sm text-emerald-700">
                  <span className="font-medium">Monthly equivalent: </span>
                  {formatJMD(getMonthlyEquivalent(parseFloat(formAmount) || 0, formFrequency))}
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowCreateModal(false);
              setEditingInvoice(null);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formCustomerName || !formDescription || !formAmount || !formStartDate || saving}
          >
            {saving ? 'Saving...' : editingInvoice ? 'Save Changes' : 'Create Recurring Invoice'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Recurring Invoice"
        size="sm"
      >
        <ModalBody>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this recurring invoice? This action cannot be undone.
            Previously generated invoices will not be affected.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
