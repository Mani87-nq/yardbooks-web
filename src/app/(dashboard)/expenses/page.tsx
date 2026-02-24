'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { PermissionGate } from '@/components/PermissionGate';
import { useAppStore } from '@/store/appStore';
import { formatJMD, formatDate } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import type { Expense } from '@/types';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  DocumentArrowUpIcon,
  FunnelIcon,
  CalendarIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// Component to handle query params (needs Suspense boundary)
function AddModalTrigger({ onTrigger }: { onTrigger: () => void }) {
  const searchParams = useSearchParams();
  const hasTriggered = React.useRef(false);

  useEffect(() => {
    if (searchParams.get('add') === 'true' && !hasTriggered.current) {
      hasTriggered.current = true;
      // Small delay to ensure component is fully mounted before opening modal
      setTimeout(() => {
        onTrigger();
        // Clean up URL after triggering
        window.history.replaceState({}, '', '/expenses');
      }, 100);
    }
  }, [searchParams, onTrigger]);

  return null;
}

const EXPENSE_CATEGORIES = [
  'Advertising & Marketing',
  'Bank Charges',
  'Cleaning & Maintenance',
  'Equipment & Tools',
  'Insurance',
  'Interest',
  'Legal & Professional',
  'Office Supplies',
  'Rent',
  'Repairs & Maintenance',
  'Salaries & Wages',
  'Telephone & Internet',
  'Transportation',
  'Travel',
  'Utilities',
  'Miscellaneous',
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
];

export default function ExpensesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [saveError, setSaveError] = useState('');

  const { expenses, addExpense, updateExpense, deleteExpense, customers, activeCompany } = useAppStore();

  const vendors = customers.filter(c => c.type === 'vendor' || c.type === 'both');

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    vendorId: '',
    paymentMethod: 'cash' as Expense['paymentMethod'],
    reference: '',
    notes: '',
    isRecurring: false,
    recurringFrequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    receiptImageUri: '' as string,
  });

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch = !searchQuery ||
      expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.vendor?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;

    const matchesDate = (!dateRange.start || new Date(expense.date) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(expense.date) <= new Date(dateRange.end));

    return matchesSearch && matchesCategory && matchesDate;
  });

  const handleOpenModal = (expense?: Expense) => {
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
        receiptImageUri: expense.receiptImageUri || '',
      });
    } else {
      setEditingExpense(null);
      setFormData({
        description: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        vendorId: '',
        paymentMethod: 'cash',
        reference: '',
        notes: '',
        isRecurring: false,
        recurringFrequency: 'monthly',
        receiptImageUri: '',
      });
    }
    setShowModal(true);
  };

  const handleSave = () => {
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

    const vendor = vendors.find(v => v.id === formData.vendorId);
    const expenseData = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: formData.category as Expense['category'],
      date: new Date(formData.date),
      vendorId: formData.vendorId || undefined,
      vendor: vendor,
      paymentMethod: formData.paymentMethod,
      reference: formData.reference || undefined,
      notes: formData.notes || undefined,
      isRecurring: formData.isRecurring,
      receiptImageUri: formData.receiptImageUri || undefined,
      gctAmount: 0,
      gctClaimable: false,
      updatedAt: new Date(),
    };

    if (editingExpense) {
      updateExpense(editingExpense.id, expenseData);
    } else {
      addExpense({
        id: uuidv4(),
        companyId: activeCompany?.id || '',
        ...expenseData,
        createdAt: new Date(),
      });
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      deleteExpense(id);
    }
  };

  // Calculate stats
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const thisMonthExpenses = expenses.filter(e => {
    const expDate = new Date(e.date);
    const now = new Date();
    return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
  }).reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      {/* Handle ?add=true query param */}
      <Suspense fallback={null}>
        <AddModalTrigger onTrigger={() => handleOpenModal()} />
      </Suspense>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500">Track and manage business expenses</p>
        </div>
        <PermissionGate permission="expenses:create">
          <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => handleOpenModal()}>
            Add Expense
          </Button>
        </PermissionGate>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Expenses</p>
            <p className="text-2xl font-bold text-gray-900">{formatJMD(totalExpenses)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">This Month</p>
            <p className="text-2xl font-bold text-blue-600">{formatJMD(thisMonthExpenses)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Top Category</p>
            <p className="text-lg font-bold text-emerald-600 truncate">
              {topCategory ? topCategory[0] : 'N/A'}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Records</p>
            <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
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
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
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

      {/* Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                  <p className="mb-4">No expenses found</p>
                  <PermissionGate permission="expenses:create">
                    <Button onClick={() => handleOpenModal()}>Add your first expense</Button>
                  </PermissionGate>
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-gray-500">{formatDate(expense.date)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{expense.description}</p>
                      {expense.reference && (
                        <p className="text-sm text-gray-500">Ref: {expense.reference}</p>
                      )}
                      {expense.isRecurring && (
                        <Badge variant="info" className="mt-1">Recurring</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{expense.category}</Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">{expense.vendor?.name || '-'}</TableCell>
                  <TableCell className="capitalize text-gray-500">
                    {expense.paymentMethod?.replace('_', ' ') || '-'}
                  </TableCell>
                  <TableCell>
                    {expense.receiptImageUri ? (
                      <button
                        onClick={() => window.open(expense.receiptImageUri, '_blank')}
                        className="group relative"
                      >
                        <img
                          src={expense.receiptImageUri}
                          alt="Receipt"
                          className="w-10 h-10 object-cover rounded border border-gray-200 group-hover:border-emerald-500 transition-colors"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                          <PhotoIcon className="w-4 h-4 text-white" />
                        </span>
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-red-600">
                    {formatJMD(expense.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <PermissionGate permission="expenses:edit">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(expense)}>
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="expenses:delete">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)}>
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as Expense['paymentMethod'] })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <select
                  value={formData.vendorId}
                  onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select vendor (optional)</option>
                  {vendors.map((v) => (
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm resize-none"
                rows={2}
              />
            </div>
            {/* Receipt/Expense Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Image</label>
              <div className="flex items-start gap-4">
                {formData.receiptImageUri ? (
                  <div className="relative w-24 h-24 rounded-lg border border-gray-300 overflow-hidden">
                    <img
                      src={formData.receiptImageUri}
                      alt="Receipt"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, receiptImageUri: '' })}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-emerald-500 transition-colors">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          setSaveError('Image must be less than 5MB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({ ...formData, receiptImageUri: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                    <PhotoIcon className="w-8 h-8 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">Upload</span>
                  </label>
                )}
                <div className="text-xs text-gray-500">
                  <p>Upload a photo of your receipt or invoice.</p>
                  <p>Max size: 5MB (JPG, PNG, WebP)</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Recurring Expense</span>
              </label>
              {formData.isRecurring && (
                <select
                  value={formData.recurringFrequency}
                  onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as any })}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
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
          <Button onClick={handleSave}>{editingExpense ? 'Update' : 'Create'}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
