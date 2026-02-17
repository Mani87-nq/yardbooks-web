'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatJMD, formatDate } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import type { Quotation, QuotationItem, InvoiceItem } from '@/types';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

const GCT_RATE = 0.15;

export default function QuotationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<Partial<QuotationItem>[]>([
    { productId: '', productName: '', quantity: 1, unitPrice: 0, discount: 0 },
  ]);

  const { quotations, addQuotation, updateQuotation, deleteQuotation, customers, products, addInvoice, activeCompany } = useAppStore();

  const [formData, setFormData] = useState({
    customerId: '',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    terms: 'Quote valid for 30 days. Prices subject to change.',
  });

  const filteredQuotations = quotations.filter((quote) => {
    const matchesSearch = !searchQuery ||
      quote.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.customerName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const generateQuotationNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const count = quotations.filter(q => {
      const d = new Date(q.createdAt);
      return d.getFullYear() === year && d.getMonth() === now.getMonth();
    }).length + 1;
    return `QT-${year}${month}-${String(count).padStart(4, '0')}`;
  };

  const handleOpenModal = (quote?: Quotation) => {
    if (quote) {
      setEditingQuotation(quote);
      setFormData({
        customerId: quote.customerId,
        validUntil: new Date(quote.validUntil).toISOString().split('T')[0],
        notes: quote.notes || '',
        terms: quote.terms || '',
      });
      setItems(quote.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
      })));
    } else {
      setEditingQuotation(null);
      setFormData({
        customerId: '',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        terms: 'Quote valid for 30 days. Prices subject to change.',
      });
      setItems([{ productId: '', productName: '', quantity: 1, unitPrice: 0, discount: 0 }]);
    }
    setShowModal(true);
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, unitPrice: 0, discount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value as string,
        productName: product?.name || '',
        unitPrice: product?.unitPrice || 0,
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => {
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
    const discount = (lineTotal * (item.discount || 0)) / 100;
    return sum + lineTotal - discount;
  }, 0);

  const taxAmount = subtotal * GCT_RATE;
  const total = subtotal + taxAmount;

  const handleSave = () => {
    if (!formData.customerId) {
      alert('Please select a customer');
      return;
    }
    if (items.some(i => !i.productId)) {
      alert('Please select a product for all items');
      return;
    }

    const customer = customers.find(c => c.id === formData.customerId);
    const quotationItems: QuotationItem[] = items.map((item, index) => ({
      id: uuidv4(),
      productId: item.productId!,
      productName: item.productName!,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      discount: item.discount || 0,
      total: ((item.quantity || 1) * (item.unitPrice || 0)) * (1 - (item.discount || 0) / 100),
    }));

    const quoteData = {
      customerId: formData.customerId,
      customerName: customer?.name || '',
      validUntil: new Date(formData.validUntil),
      items: quotationItems,
      subtotal,
      taxAmount,
      total,
      notes: formData.notes || undefined,
      terms: formData.terms || undefined,
      updatedAt: new Date(),
    };

    if (editingQuotation) {
      updateQuotation(editingQuotation.id, quoteData);
    } else {
      addQuotation({
        id: uuidv4(),
        companyId: activeCompany?.id || '',
        quotationNumber: generateQuotationNumber(),
        ...quoteData,
        status: 'draft',
        createdAt: new Date(),
      });
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this quotation?')) {
      deleteQuotation(id);
    }
  };

  const handleSend = (quote: Quotation) => {
    updateQuotation(quote.id, { status: 'sent', sentAt: new Date() });
    alert('Quotation marked as sent!');
  };

  const handleAccept = (quote: Quotation) => {
    updateQuotation(quote.id, { status: 'accepted', acceptedAt: new Date() });
    alert('Quotation marked as accepted!');
  };

  const handleReject = (quote: Quotation) => {
    updateQuotation(quote.id, { status: 'rejected' });
    alert('Quotation marked as rejected.');
  };

  const handleConvertToInvoice = (quote: Quotation) => {
    if (quote.status !== 'accepted') {
      alert('Only accepted quotations can be converted to invoices');
      return;
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    // Map QuotationItems to InvoiceItems
    const invoiceItems: InvoiceItem[] = quote.items.map(item => ({
      id: uuidv4(),
      productId: item.productId,
      description: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gctRate: 'standard' as const,
      gctAmount: item.total * 0.15,
      total: item.total,
    }));

    addInvoice({
      id: uuidv4(),
      companyId: activeCompany?.id || '',
      invoiceNumber,
      customerId: quote.customerId,
      customer: quote.customer,
      items: invoiceItems,
      subtotal: quote.subtotal,
      gctAmount: quote.taxAmount || quote.subtotal * 0.15,
      discount: 0,
      discountType: 'fixed',
      total: quote.total,
      amountPaid: 0,
      balance: quote.total,
      status: 'draft',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: quote.notes,
      terms: quote.terms,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    updateQuotation(quote.id, { convertedToInvoice: true });
    alert('Invoice created from quotation!');
  };

  // Stats
  const stats = {
    total: quotations.length,
    draft: quotations.filter(q => q.status === 'draft').length,
    sent: quotations.filter(q => q.status === 'sent').length,
    accepted: quotations.filter(q => q.status === 'accepted').length,
    totalValue: quotations.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.total, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-500">Create and manage customer quotes</p>
        </div>
        <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => handleOpenModal()}>
          New Quotation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Quotes</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Draft</p>
            <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Sent</p>
            <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Accepted</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.accepted}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Accepted Value</p>
            <p className="text-2xl font-bold text-emerald-600">{formatJMD(stats.totalValue)}</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search quotations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                  <p className="mb-4">No quotations found</p>
                  <Button onClick={() => handleOpenModal()}>Create your first quotation</Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredQuotations.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-mono text-gray-600">{quote.quotationNumber}</TableCell>
                  <TableCell className="font-medium">{quote.customerName}</TableCell>
                  <TableCell className="text-gray-500">{formatDate(quote.createdAt)}</TableCell>
                  <TableCell className="text-gray-500">{formatDate(quote.validUntil)}</TableCell>
                  <TableCell className="font-medium">{formatJMD(quote.total)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        quote.status === 'accepted' ? 'success' :
                        quote.status === 'sent' ? 'info' :
                        quote.status === 'rejected' ? 'default' :
                        quote.status === 'expired' ? 'warning' :
                        'default'
                      }
                    >
                      {quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {quote.status === 'draft' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleSend(quote)} title="Send">
                            <PaperAirplaneIcon className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(quote)}>
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {quote.status === 'sent' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleAccept(quote)} title="Accept">
                            <CheckIcon className="w-4 h-4 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleReject(quote)} title="Reject">
                            <XMarkIcon className="w-4 h-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      {quote.status === 'accepted' && !quote.convertedToInvoice && (
                        <Button variant="ghost" size="sm" onClick={() => handleConvertToInvoice(quote)} title="Convert to Invoice">
                          <DocumentDuplicateIcon className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(quote.id)}>
                        <TrashIcon className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingQuotation ? 'Edit Quotation' : 'New Quotation'}
        size="xl"
      >
        <ModalBody>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select customer</option>
                  {customers.filter(c => c.type === 'customer' || c.type === 'both').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Valid Until"
                type="date"
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Items</label>
                <Button variant="outline" size="sm" onClick={handleAddItem}>
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-20">Qty</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">Price</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-20">Disc %</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">Total</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, index) => {
                      const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
                      const discount = (lineTotal * (item.discount || 0)) / 100;
                      const itemTotal = lineTotal - discount;

                      return (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <select
                              value={item.productId || ''}
                              onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            >
                              <option value="">Select product</option>
                              {products.filter(p => p.isActive).map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.unitPrice || ''}
                              onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount || ''}
                              onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatJMD(itemTotal)}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="font-medium">{formatJMD(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">GCT (15%):</span>
                    <span className="font-medium">{formatJMD(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-emerald-600">{formatJMD(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm resize-none"
                  rows={3}
                  placeholder="Additional notes for the customer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                <textarea
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm resize-none"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave}>{editingQuotation ? 'Update' : 'Create'} Quotation</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
