'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, ModalBody, ModalFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Select, Textarea } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useCustomers, useInvoices } from '@/hooks/api';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  XCircleIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ReceiptRefundIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

type CreditNoteStatus = 'draft' | 'approved' | 'applied' | 'void';

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  customerId: string;
  customerName: string;
  invoiceRef: string;
  amount: number;
  reason: string;
  notes: string;
  status: CreditNoteStatus;
  createdAt: Date;
  approvedAt?: Date;
  appliedAt?: Date;
  voidedAt?: Date;
}

// ============================================
// HELPERS
// ============================================

function getStatusBadge(status: CreditNoteStatus) {
  const config: Record<CreditNoteStatus, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
    draft: { variant: 'default', label: 'Draft' },
    approved: { variant: 'info', label: 'Approved' },
    applied: { variant: 'success', label: 'Applied' },
    void: { variant: 'danger', label: 'Void' },
  };
  const { variant, label } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

// ============================================
// COMPONENT
// ============================================

export default function CreditNotesPage() {
  const { fc } = useCurrency();
  // Fetch customers & invoices from API for dropdowns
  const { data: customersResponse } = useCustomers({ limit: 200 });
  const { data: invoicesResponse } = useInvoices({ limit: 200 });
  const customers = (customersResponse as any)?.data ?? [];
  const invoices = (invoicesResponse as any)?.data ?? [];

  // API-driven state
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    invoiceRef: '',
    amount: '',
    reason: '',
    notes: '',
  });

  const fetchCreditNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<{ data: CreditNote[] } | CreditNote[]>('/api/v1/credit-notes');
      const list = Array.isArray(data) ? data : (data as any).data ?? [];
      setCreditNotes(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load credit notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreditNotes();
  }, [fetchCreditNotes]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const statuses: string[] = ['all', 'draft', 'approved', 'applied', 'void'];

  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter((cn) => {
      const matchesSearch =
        !searchQuery ||
        cn.creditNoteNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cn.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cn.invoiceRef?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cn.reason?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || cn.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [creditNotes, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: creditNotes.length,
      pendingApproval: creditNotes.filter((cn) => cn.status === 'draft').length,
      applied: creditNotes.filter((cn) => cn.status === 'applied').length,
      totalValue: creditNotes
        .filter((cn) => cn.status !== 'void')
        .reduce((sum, cn) => sum + Number(cn.amount || 0), 0),
    };
  }, [creditNotes]);

  // Customer invoices for the form selector
  const selectedCustomerInvoices = useMemo(() => {
    if (!formData.customerId) return [];
    return invoices.filter((inv: any) => inv.customerId === formData.customerId);
  }, [formData.customerId, invoices]);

  // Customer options for the form selector
  const customerOptions = useMemo(() => {
    const storeCustomers = customers.map((c: any) => ({
      value: c.id,
      label: c.name,
    }));
    return [{ value: '', label: 'Select a customer...' }, ...storeCustomers];
  }, [customers]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleOpenCreateModal = () => {
    setFormData({
      customerId: '',
      customerName: '',
      invoiceRef: '',
      amount: '',
      reason: '',
      notes: '',
    });
    setShowCreateModal(true);
  };

  const handleCreateCreditNote = async () => {
    if (!formData.customerId || !formData.amount || !formData.reason) {
      alert('Please fill in all required fields: Customer, Amount, and Reason.');
      return;
    }

    setSaving(true);
    try {
      const customerLabel =
        customerOptions.find((c) => c.value === formData.customerId)?.label || 'Unknown';

      await api.post('/api/v1/credit-notes', {
        customerId: formData.customerId,
        customerName: customerLabel,
        invoiceRef: formData.invoiceRef || 'N/A',
        amount: parseFloat(formData.amount),
        reason: formData.reason,
        notes: formData.notes,
      });

      setShowCreateModal(false);
      fetchCreditNotes();
    } catch (err: any) {
      alert(err.message || 'Failed to create credit note');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/api/v1/credit-notes/${id}`, { status: 'approved' });
      fetchCreditNotes();
      if (selectedCreditNote?.id === id) {
        setSelectedCreditNote((prev) =>
          prev ? { ...prev, status: 'approved', approvedAt: new Date() } : prev
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve credit note');
    }
  };

  const handleApplyToInvoice = async (id: string) => {
    try {
      await api.put(`/api/v1/credit-notes/${id}`, { status: 'applied' });
      fetchCreditNotes();
      if (selectedCreditNote?.id === id) {
        setSelectedCreditNote((prev) =>
          prev ? { ...prev, status: 'applied', appliedAt: new Date() } : prev
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to apply credit note');
    }
  };

  const handleVoid = async (id: string) => {
    try {
      await api.put(`/api/v1/credit-notes/${id}`, { status: 'void' });
      fetchCreditNotes();
      if (selectedCreditNote?.id === id) {
        setSelectedCreditNote((prev) =>
          prev ? { ...prev, status: 'void', voidedAt: new Date() } : prev
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to void credit note');
    }
  };

  const handleViewDetail = (cn: CreditNote) => {
    setSelectedCreditNote(cn);
    setShowDetailView(true);
  };

  const handleBackToList = () => {
    setShowDetailView(false);
    setSelectedCreditNote(null);
  };

  // ============================================
  // LOADING / ERROR
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading credit notes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-600">{error}</p>
        <Button onClick={fetchCreditNotes}>Retry</Button>
      </div>
    );
  }

  // ============================================
  // DETAIL VIEW
  // ============================================

  if (showDetailView && selectedCreditNote) {
    const cn = creditNotes.find((c) => c.id === selectedCreditNote.id) || selectedCreditNote;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBackToList}>
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{cn.creditNoteNumber}</h1>
              {getStatusBadge(cn.status)}
            </div>
            <p className="text-gray-500 dark:text-gray-400">Credit note for {cn.customerName}</p>
          </div>
          <div className="flex gap-2">
            {cn.status === 'draft' && (
              <Button
                variant="primary"
                icon={<CheckCircleIcon className="w-4 h-4" />}
                onClick={() => handleApprove(cn.id)}
              >
                Approve
              </Button>
            )}
            {cn.status === 'approved' && (
              <Button
                variant="primary"
                icon={<DocumentCheckIcon className="w-4 h-4" />}
                onClick={() => handleApplyToInvoice(cn.id)}
              >
                Apply to Invoice
              </Button>
            )}
            {(cn.status === 'draft' || cn.status === 'approved') && (
              <Button
                variant="danger"
                icon={<XCircleIcon className="w-4 h-4" />}
                onClick={() => handleVoid(cn.id)}
              >
                Void
              </Button>
            )}
          </div>
        </div>

        {/* Detail Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Information */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Credit Note Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Credit Note Number</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{cn.creditNoteNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{cn.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Invoice Reference</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{cn.invoiceRef}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Amount</p>
                    <p className="text-lg font-bold text-emerald-600">{fc(cn.amount)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reason</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{cn.reason}</p>
                  </div>
                  {cn.notes && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mt-1">
                        {cn.notes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Created</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(cn.createdAt)}</p>
                    </div>
                  </div>
                  {cn.approvedAt && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Approved</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(cn.approvedAt)}</p>
                      </div>
                    </div>
                  )}
                  {cn.appliedAt && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Applied to {cn.invoiceRef}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(cn.appliedAt)}</p>
                      </div>
                    </div>
                  )}
                  {cn.voidedAt && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-2 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Voided</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(cn.voidedAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // LIST VIEW
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Credit Notes</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage credit notes and refund adjustments</p>
        </div>
        <Button icon={<PlusIcon className="w-4 h-4" />} onClick={handleOpenCreateModal}>
          New Credit Note
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <DocumentTextIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Credit Notes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <ClockIcon className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingApproval}</p>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Applied</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.applied}</p>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <CurrencyDollarIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
                <p className="text-2xl font-bold text-blue-600">{fc(stats.totalValue)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search credit notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            rightIcon={searchQuery ? (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XMarkIcon className="w-5 h-5" />
              </button>
            ) : undefined}
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
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Credit Notes Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CN #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice Ref</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCreditNotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center gap-3">
                    <ReceiptRefundIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                    <p>No credit notes found</p>
                    <Button onClick={handleOpenCreateModal}>Create your first credit note</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCreditNotes.map((cn) => (
                <TableRow key={cn.id}>
                  <TableCell className="font-medium text-emerald-700">
                    {cn.creditNoteNumber}
                  </TableCell>
                  <TableCell>{cn.customerName}</TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400">{cn.invoiceRef}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-gray-600 dark:text-gray-400">
                    {cn.reason}
                  </TableCell>
                  <TableCell className="font-medium">{fc(cn.amount)}</TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400">{formatDate(cn.createdAt)}</TableCell>
                  <TableCell>{getStatusBadge(cn.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="View details"
                        onClick={() => handleViewDetail(cn)}
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Button>
                      {cn.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Approve"
                          onClick={() => handleApprove(cn.id)}
                        >
                          <CheckCircleIcon className="w-4 h-4 text-blue-600" />
                        </Button>
                      )}
                      {cn.status === 'approved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Apply to invoice"
                          onClick={() => handleApplyToInvoice(cn.id)}
                        >
                          <DocumentCheckIcon className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                      {(cn.status === 'draft' || cn.status === 'approved') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Void"
                          onClick={() => handleVoid(cn.id)}
                        >
                          <XCircleIcon className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Credit Note Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Credit Note"
        description="Issue a new credit note against a customer invoice"
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            <Select
              label="Customer *"
              options={customerOptions}
              value={formData.customerId}
              onChange={(e) => {
                const custId = e.target.value;
                const custLabel = customerOptions.find((c) => c.value === custId)?.label || '';
                setFormData((prev) => ({
                  ...prev,
                  customerId: custId,
                  customerName: custLabel,
                  invoiceRef: '',
                }));
              }}
            />

            {formData.customerId && selectedCustomerInvoices.length > 0 ? (
              <Select
                label="Invoice Reference"
                options={[
                  { value: '', label: 'Select an invoice...' },
                  ...selectedCustomerInvoices.map((inv: any) => ({
                    value: inv.invoiceNumber,
                    label: `${inv.invoiceNumber} - ${fc(inv.total)}`,
                  })),
                ]}
                value={formData.invoiceRef}
                onChange={(e) => setFormData((prev) => ({ ...prev, invoiceRef: e.target.value }))}
              />
            ) : (
              <Input
                label="Invoice Reference"
                placeholder="e.g. INV-001"
                value={formData.invoiceRef}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, invoiceRef: e.target.value }))
                }
              />
            )}

            <Input
              label="Amount (J$) *"
              type="number"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
            />

            <Input
              label="Reason *"
              placeholder="e.g. Return of damaged goods"
              value={formData.reason}
              onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
            />

            <Textarea
              label="Notes"
              placeholder="Additional details about this credit note..."
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateCreditNote} icon={<PlusIcon className="w-4 h-4" />} disabled={saving}>
            {saving ? 'Creating...' : 'Create Credit Note'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
