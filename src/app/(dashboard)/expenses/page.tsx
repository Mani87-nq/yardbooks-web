'use client';

import React, { useState } from 'react';
import { Card, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useCustomers,
} from '@/hooks/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  CameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { PermissionGate } from '@/components/PermissionGate';
import { getAccessToken } from '@/lib/api-client';

interface ExpenseAPI {
  id: string;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
  category: string;
  description: string;
  amount: number;
  gctAmount: number;
  gctClaimable: boolean;
  date: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  isRecurring?: boolean;
  createdAt: string;
}

const EXPENSE_CATEGORIES = [
  { value: 'ADVERTISING', label: 'Advertising & Marketing' },
  { value: 'BANK_FEES', label: 'Bank Charges' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'EQUIPMENT', label: 'Equipment & Tools' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'MEALS', label: 'Meals' },
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies' },
  { value: 'PROFESSIONAL_SERVICES', label: 'Legal & Professional' },
  { value: 'RENT', label: 'Rent' },
  { value: 'REPAIRS', label: 'Repairs & Maintenance' },
  { value: 'SALARIES', label: 'Salaries & Wages' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'TAXES', label: 'Taxes' },
  { value: 'TELEPHONE', label: 'Telephone & Internet' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'VEHICLE', label: 'Vehicle / Transportation' },
  { value: 'OTHER', label: 'Other / Miscellaneous' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

export default function ExpensesPage() {
  const { fc } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseAPI | null>(null);
  const [saveError, setSaveError] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  // API hooks
  const { data: expensesResponse, isLoading, error: fetchError, refetch } = useExpenses({
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    limit: 200,
  });
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  // Fetch vendors (customers with type vendor/both) for the dropdown
  const { data: vendorsResponse } = useCustomers({ type: 'vendor', limit: 200 });
  const vendors = (vendorsResponse as any)?.data ?? [];

  const allExpenses: ExpenseAPI[] = (expensesResponse as any)?.data ?? [];

  // Client-side filtering for search and date range
  const expenses = allExpenses.filter((expense) => {
    const lowerQuery = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      expense.description.toLowerCase().includes(lowerQuery) ||
      expense.vendor?.name.toLowerCase().includes(lowerQuery) ||
      expense.category?.toLowerCase().includes(lowerQuery) ||
      expense.reference?.toLowerCase().includes(lowerQuery) ||
      expense.notes?.toLowerCase().includes(lowerQuery) ||
      expense.amount.toString().includes(searchQuery);

    const matchesDate = (!dateRange.start || new Date(expense.date) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(expense.date) <= new Date(dateRange.end));

    return matchesSearch && matchesDate;
  });

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    vendorId: '',
    paymentMethod: 'CASH',
    reference: '',
    notes: '',
    isRecurring: false,
    recurringFrequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  });

  const handleOpenModal = (expense?: ExpenseAPI) => {
    setSaveError('');
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        description: expense.description,
        amount: expense.amount.toString(),
        category: expense.category,
        date: new Date(expense.date).toISOString().split('T')[0],
        vendorId: expense.vendorId || '',
        paymentMethod: expense.paymentMethod || 'cash',
        reference: expense.reference || '',
        notes: expense.notes || '',
        isRecurring: expense.isRecurring || false,
        recurringFrequency: 'monthly',
      });
    } else {
      setEditingExpense(null);
      setFormData({
        description: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        vendorId: '',
        paymentMethod: 'CASH',
        reference: '',
        notes: '',
        isRecurring: false,
        recurringFrequency: 'monthly',
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!formData.description.trim()) {
      setSaveError('Please enter a description');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setSaveError('Please enter a valid amount');
      return;
    }
    if (!formData.category) {
      setSaveError('Please select a category');
      return;
    }

    const payload: Record<string, unknown> = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: formData.category,
      date: formData.date,
      vendorId: formData.vendorId || undefined,
      paymentMethod: formData.paymentMethod,
      reference: formData.reference || undefined,
      notes: formData.notes || undefined,
      isRecurring: formData.isRecurring,
      gctAmount: 0,
      gctClaimable: false,
    };

    try {
      if (editingExpense) {
        await updateExpense.mutateAsync({ id: editingExpense.id, data: payload });
      } else {
        await createExpense.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save expense';
      setSaveError(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteExpense.mutateAsync(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete expense';
        alert(message);
      }
    }
  };

  const handleScanReceipt = async () => {
    if (!scanFile) return;
    setScanning(true);
    setScanError('');
    try {
      const formData = new FormData();
      formData.append('image', scanFile);
      const token = getAccessToken();
      const res = await fetch('/api/v1/expenses/scan-receipt', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `Scan failed (${res.status})`);
      }
      const { data } = await res.json();
      const extracted = data.extracted;
      let parsedDate = new Date().toISOString().split('T')[0];
      if (extracted.date) {
        const d = new Date(extracted.date);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split('T')[0];
        }
      }
      setFormData({
        description: extracted.vendor || '',
        amount: String(extracted.total || ''),
        category: EXPENSE_CATEGORIES[0].value,
        date: parsedDate,
        vendorId: '',
        paymentMethod: (extracted.paymentMethod || 'CASH').toUpperCase(),
        reference: '',
        notes: `Scanned from receipt (confidence: ${extracted.confidence})`,
        isRecurring: false,
        recurringFrequency: 'monthly',
      });
      setShowScanModal(false);
      setScanFile(null);
      setEditingExpense(null);
      setShowModal(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to scan receipt';
      setScanError(message);
    } finally {
      setScanning(false);
    }
  };

  const getCategoryLabel = (value: string) =>
    EXPENSE_CATEGORIES.find(c => c.value === value)?.label || value.replace(/_/g, ' ');
  const getPaymentLabel = (value: string) =>
    PAYMENT_METHODS.find(p => p.value === value)?.label || value.replace(/_/g, ' ');

  const totalExpenses = allExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const thisMonthExpenses = allExpenses.filter(e => {
    const expDate = new Date(e.date);
    const now = new Date();
    return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
  }).reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const categoryTotals = allExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-500 dark:text-gray-400">Track and manage business expenses</p>
        </div>
        <div className="flex gap-2">
          <PermissionGate permission="expenses:create">
            <Button variant="outline" onClick={() => setShowScanModal(true)}>
              <CameraIcon className="w-4 h-4 mr-2" />
              Scan Receipt
            </Button>
          </PermissionGate>
          <PermissionGate permission="expenses:create">
            <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => handleOpenModal()}>
              Add Expense
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Error State */}
      {fetchError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-300">Failed to load expenses. {fetchError instanceof Error ? fetchError.message : ''}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <ArrowPathIcon className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Expenses</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{isLoading ? '-' : fc(totalExpenses)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
            <p className="text-2xl font-bold text-blue-600">{isLoading ? '-' : fc(thisMonthExpenses)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Top Category</p>
            <p className="text-lg font-bold text-emerald-600 truncate">
              {isLoading ? '-' : topCategory ? getCategoryLabel(topCategory[0]) : 'N/A'}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Records</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{isLoading ? '-' : allExpenses.length}</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search expenses..."
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
        <div className="flex gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 text-sm"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="w-40"
          />
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-40"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Loading expenses...</p>
          </div>
        </Card>
      )}

      {/* Table */}
      {!isLoading && (
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="mb-4">No expenses found</p>
                  <PermissionGate permission="expenses:create">
                    <Button onClick={() => handleOpenModal()}>Add your first expense</Button>
                  </PermissionGate>
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-gray-500 dark:text-gray-400">{formatDate(expense.date)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{expense.description}</p>
                      {expense.reference && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Ref: {expense.reference}</p>
                      )}
                      {expense.isRecurring && (
                        <Badge variant="info" className="mt-1">Recurring</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{getCategoryLabel(expense.category)}</Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400">{expense.vendor?.name || '-'}</TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400">
                    {expense.paymentMethod ? getPaymentLabel(expense.paymentMethod) : '-'}
                  </TableCell>
                  <TableCell className="font-medium text-red-600">
                    {fc(expense.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <PermissionGate permission="expenses:update">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(expense)}>
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="expenses:delete">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(expense.id)}
                          disabled={deleteExpense.isPending}
                        >
                          <TrashIcon className="w-4 h-4 text-red-500" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            {saveError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
                {saveError}
              </div>
            )}
            <Input
              label="Description *"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was this expense for?"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amount *"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
              <Input
                label="Date *"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
                <select
                  value={formData.vendorId}
                  onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select vendor (optional)</option>
                  {vendors.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Reference Number"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Invoice/Receipt #"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm resize-none"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Recurring Expense</span>
              </label>
              {formData.isRecurring && (
                <select
                  value={formData.recurringFrequency}
                  onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as any })}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={createExpense.isPending || updateExpense.isPending}
          >
            {(createExpense.isPending || updateExpense.isPending) ? 'Saving...' : editingExpense ? 'Update' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Scan Receipt Modal */}
      <Modal
        isOpen={showScanModal}
        onClose={() => { setShowScanModal(false); setScanFile(null); setScanError(''); }}
        title="Scan Receipt"
      >
        <ModalBody>
          <div className="space-y-4">
            {scanError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
                {scanError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Upload Receipt Image
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  setScanFile(e.target.files?.[0] || null);
                  setScanError('');
                }}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium mb-1">What will be extracted:</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-300">
                <li>Vendor / store name</li>
                <li>Total amount</li>
                <li>Date of purchase</li>
                <li>Payment method</li>
              </ul>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setShowScanModal(false); setScanFile(null); setScanError(''); }}>
            Cancel
          </Button>
          <Button
            onClick={handleScanReceipt}
            disabled={!scanFile || scanning}
          >
            {scanning ? 'Scanning...' : 'Scan'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
