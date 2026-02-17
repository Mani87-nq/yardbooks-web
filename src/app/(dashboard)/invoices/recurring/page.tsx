'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, ModalBody, ModalFooter, Select } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
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
// SAMPLE DATA
// ============================================

const INITIAL_RECURRING_INVOICES: RecurringInvoice[] = [
  {
    id: 'ri-001',
    customerName: 'Dolphy Enterprises',
    customerId: 'cust-001',
    description: 'Monthly website hosting',
    amount: 15000,
    frequency: 'monthly',
    startDate: '2025-01-01',
    endDate: null,
    nextInvoiceDate: '2026-03-01',
    status: 'active',
    createdAt: '2025-01-01',
    invoicesGenerated: 14,
  },
  {
    id: 'ri-002',
    customerName: 'Island Tech Solutions',
    customerId: 'cust-002',
    description: 'Quarterly consulting retainer',
    amount: 125000,
    frequency: 'quarterly',
    startDate: '2025-04-01',
    endDate: null,
    nextInvoiceDate: '2026-04-01',
    status: 'active',
    createdAt: '2025-04-01',
    invoicesGenerated: 4,
  },
  {
    id: 'ri-003',
    customerName: 'Yardie Foods',
    customerId: 'cust-003',
    description: 'Weekly supplies delivery',
    amount: 8500,
    frequency: 'weekly',
    startDate: '2025-06-01',
    endDate: null,
    nextInvoiceDate: '2026-02-24',
    status: 'active',
    createdAt: '2025-06-01',
    invoicesGenerated: 37,
  },
  {
    id: 'ri-004',
    customerName: 'Kingston Motors',
    customerId: 'cust-004',
    description: 'Monthly fleet maintenance',
    amount: 45000,
    frequency: 'monthly',
    startDate: '2025-03-01',
    endDate: null,
    nextInvoiceDate: '2026-02-01',
    status: 'paused',
    createdAt: '2025-03-01',
    invoicesGenerated: 10,
  },
];

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

function generateNextDate(startDate: string, frequency: Frequency): string {
  const date = new Date(startDate);
  const now = new Date();

  while (date <= now) {
    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
  }

  return date.toISOString().split('T')[0];
}

// ============================================
// COMPONENT
// ============================================

export default function RecurringInvoicesPage() {
  const { customers } = useAppStore();

  // State
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>(INITIAL_RECURRING_INVOICES);
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
    const storeCustomers = customers.map((c) => ({ value: c.name, label: c.name }));
    if (storeCustomers.length === 0) {
      return [
        { value: '', label: 'Select a customer...' },
        { value: 'Dolphy Enterprises', label: 'Dolphy Enterprises' },
        { value: 'Island Tech Solutions', label: 'Island Tech Solutions' },
        { value: 'Yardie Foods', label: 'Yardie Foods' },
        { value: 'Kingston Motors', label: 'Kingston Motors' },
        { value: 'Blue Mountain Coffee Co.', label: 'Blue Mountain Coffee Co.' },
        { value: 'Reggae Rhythms Ltd.', label: 'Reggae Rhythms Ltd.' },
      ];
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

  const handleSave = () => {
    if (!formCustomerName || !formDescription || !formAmount || !formStartDate) {
      return;
    }

    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (editingInvoice) {
      // Update existing
      setRecurringInvoices((prev) =>
        prev.map((ri) =>
          ri.id === editingInvoice.id
            ? {
                ...ri,
                customerName: formCustomerName,
                description: formDescription,
                amount,
                frequency: formFrequency,
                startDate: formStartDate,
                endDate: formEndDate || null,
                nextInvoiceDate: generateNextDate(formStartDate, formFrequency),
              }
            : ri
        )
      );
    } else {
      // Create new
      const newInvoice: RecurringInvoice = {
        id: `ri-${Date.now()}`,
        customerName: formCustomerName,
        customerId: `cust-${Date.now()}`,
        description: formDescription,
        amount,
        frequency: formFrequency,
        startDate: formStartDate,
        endDate: formEndDate || null,
        nextInvoiceDate: generateNextDate(formStartDate, formFrequency),
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
        invoicesGenerated: 0,
      };
      setRecurringInvoices((prev) => [newInvoice, ...prev]);
    }

    setShowCreateModal(false);
    resetForm();
    setEditingInvoice(null);
  };

  const handleToggleStatus = (id: string) => {
    setRecurringInvoices((prev) =>
      prev.map((ri) =>
        ri.id === id
          ? { ...ri, status: ri.status === 'active' ? 'paused' : 'active' as RecurringStatus }
          : ri
      )
    );
  };

  const handleDelete = (id: string) => {
    setRecurringInvoices((prev) => prev.filter((ri) => ri.id !== id));
    setShowDeleteConfirm(null);
  };

  const statuses = ['all', 'active', 'paused', 'expired'];

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
            disabled={!formCustomerName || !formDescription || !formAmount || !formStartDate}
          >
            {editingInvoice ? 'Save Changes' : 'Create Recurring Invoice'}
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
