'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Select, Textarea } from '@/components/ui';
import { useAppStore, useActiveCustomers, useActiveProducts } from '@/store/appStore';
import { formatJMD, GCT_RATES } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import type { Invoice, InvoiceItem, GCTRate } from '@/types';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

export default function NewInvoicePage() {
  const router = useRouter();
  const { addInvoice, activeCompany, settings } = useAppStore();
  const customers = useActiveCustomers();
  const products = useActiveProducts();

  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([
    { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, gctRate: 'standard' as GCTRate, gctAmount: 0, total: 0 },
  ]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, gctRate: 'standard' as GCTRate, gctAmount: 0, total: 0 },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };

        // Recalculate totals
        const qty = updated.quantity || 0;
        const price = updated.unitPrice || 0;
        const subtotal = qty * price;
        const gctRate = GCT_RATES[updated.gctRate as keyof typeof GCT_RATES] || 0;
        const gctAmount = subtotal * gctRate;

        return {
          ...updated,
          gctAmount,
          total: subtotal + gctAmount,
        };
      })
    );
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    handleItemChange(itemId, 'productId', productId);
    handleItemChange(itemId, 'description', product.name);
    handleItemChange(itemId, 'unitPrice', product.unitPrice);
    handleItemChange(itemId, 'gctRate', product.gctRate);
  };

  const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const gctAmount = items.reduce((sum, item) => sum + (item.gctAmount || 0), 0);
  const total = items.reduce((sum, item) => sum + (item.total || 0), 0);

  const handleSubmit = (status: 'draft' | 'sent') => {
    if (!customerId) {
      alert('Please select a customer');
      return;
    }

    const customer = customers.find((c) => c.id === customerId);
    const invoiceNumber = `${settings.invoicePrefix}${String(Date.now()).slice(-6)}`;

    const invoice: Invoice = {
      id: uuidv4(),
      companyId: activeCompany?.id || '',
      invoiceNumber,
      customerId,
      customer,
      items: items as InvoiceItem[],
      subtotal,
      gctAmount,
      discount: 0,
      discountType: 'fixed',
      total,
      amountPaid: 0,
      balance: total,
      status,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addInvoice(invoice);
    router.push('/invoices');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Invoice</h1>
          <p className="text-gray-500">Create a new sales invoice</p>
        </div>
      </div>

      {/* Customer & Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            options={[
              { value: '', label: 'Select a customer...' },
              ...customers.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Issue Date"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase">
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-2">GCT</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            {/* Items */}
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Input
                    placeholder="Description or search product..."
                    value={item.description}
                    onChange={(e) => handleItemChange(item.id!, 'description', e.target.value)}
                    list={`products-${item.id}`}
                  />
                  <datalist id={`products-${item.id}`}>
                    {products.map((p) => (
                      <option key={p.id} value={p.name} onClick={() => handleProductSelect(item.id!, p.id)} />
                    ))}
                  </datalist>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id!, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(item.id!, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Select
                    value={item.gctRate}
                    onChange={(e) => handleItemChange(item.id!, 'gctRate', e.target.value)}
                    options={[
                      { value: 'standard', label: '15%' },
                      { value: 'zero_rated', label: '0%' },
                      { value: 'exempt', label: 'Exempt' },
                    ]}
                  />
                </div>
                <div className="col-span-1 text-right font-medium">
                  {formatJMD(item.total || 0)}
                </div>
                <div className="col-span-1 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(item.id!)}
                    disabled={items.length === 1}
                  >
                    <TrashIcon className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={handleAddItem}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Line Item
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals & Notes */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add notes or terms..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{formatJMD(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">GCT</span>
              <span className="font-medium">{formatJMD(gctAmount)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-emerald-600">{formatJMD(total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href="/invoices">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button variant="secondary" onClick={() => handleSubmit('draft')}>
          Save as Draft
        </Button>
        <Button onClick={() => handleSubmit('sent')}>
          Create & Send
        </Button>
      </div>
    </div>
  );
}
