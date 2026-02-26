'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Textarea } from '@/components/ui';
import { useActiveCustomers, useActiveProducts } from '@/store/appStore';
import { GCT_RATES } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useInvoice, useUpdateInvoice } from '@/hooks/api/useInvoices';
import { v4 as uuidv4 } from 'uuid';
import type { InvoiceItem, GCTRate, InvoiceStatus } from '@/types';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditInvoicePage({ params }: PageProps) {
  const { fc } = useCurrency();
  const { id } = use(params);
  const router = useRouter();
  const { data: invoice, isLoading: isFetchingInvoice } = useInvoice(id);
  const updateInvoiceMutation = useUpdateInvoice();
  const customers = useActiveCustomers();
  const products = useActiveProducts();

  const [customerId, setCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [customerPONumber, setCustomerPONumber] = useState('');
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([]);
  const [isFormReady, setIsFormReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (invoice && !isFormReady) {
      setCustomerId(invoice.customerId);
      setInvoiceNumber(invoice.invoiceNumber);
      setIssueDate(new Date(invoice.issueDate).toISOString().split('T')[0]);
      setDueDate(new Date(invoice.dueDate).toISOString().split('T')[0]);
      setStatus((invoice.status?.toLowerCase() || 'draft') as InvoiceStatus);
      setNotes(invoice.notes || '');
      setTerms(invoice.terms || '');
      setDiscount(Number(invoice.discount) || 0);
      setDiscountType((invoice.discountType?.toLowerCase() || 'fixed') as 'fixed' | 'percentage');
      setCustomerPONumber(invoice.customerPONumber || '');
      const invoiceItems = invoice.items?.length > 0
        ? invoice.items.map((item: any) => ({
            ...item,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            gctAmount: Number(item.gctAmount),
            total: Number(item.total),
            gctRate: (item.gctRate?.toLowerCase() || 'standard') as GCTRate,
          }))
        : [{ id: uuidv4(), description: '', quantity: 1, unitPrice: 0, gctRate: 'standard' as GCTRate, gctAmount: 0, total: 0 }];
      setItems(invoiceItems);
      setIsFormReady(true);
    }
  }, [invoice, isFormReady]);

  if (isFetchingInvoice) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Invoice Not Found</h2>
        <Link href="/invoices" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Back to Invoices
        </Link>
      </div>
    );
  }

  if (!isFormReady) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, gctRate: 'standard' as GCTRate, gctAmount: 0, total: 0 },
    ]);
  };

  const handleRemoveItem = (itemId: string) => {
    if (items.length === 1) return;
    setItems(items.filter((item) => item.id !== itemId));
  };

  const handleItemChange = (itemId: string, field: keyof InvoiceItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id !== itemId) return item;
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

    setItems(
      items.map((item) => {
        if (item.id !== itemId) return item;
        const subtotal = 1 * product.unitPrice;
        const gctRate = GCT_RATES[product.gctRate as keyof typeof GCT_RATES] || 0;
        const gctAmount = subtotal * gctRate;

        return {
          ...item,
          productId,
          description: product.name,
          quantity: 1,
          unitPrice: product.unitPrice,
          gctRate: product.gctRate,
          gctAmount,
          total: subtotal + gctAmount,
        };
      })
    );
  };

  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
  const gctAmount = items.reduce((sum, item) => sum + Number(item.gctAmount || 0), 0);
  const discountAmount = discountType === 'percentage' ? (subtotal + gctAmount) * (discount / 100) : discount;
  const total = subtotal + gctAmount - discountAmount;

  const handleSubmit = async () => {
    if (!customerId) {
      alert('Please select a customer');
      return;
    }

    if (items.every(item => !item.description)) {
      alert('Please add at least one line item');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const amountPaid = Number(invoice.amountPaid) || 0;
      const balance = total - amountPaid;
      const resolvedStatus = balance <= 0 && amountPaid > 0 ? 'PAID' : status.toUpperCase();

      const updatedData = {
        status: resolvedStatus,
        customerId,
        issueDate: new Date(issueDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        notes: notes || null,
        terms: terms || null,
        discount,
        discountType: discountType.toUpperCase(),
        customerPONumber: customerPONumber || null,
        items: items.map((item) => ({
          productId: item.productId || null,
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          gctRate: (item.gctRate || 'standard').toUpperCase(),
          gctAmount: item.gctAmount || 0,
          total: item.total || 0,
        })),
      };

      await updateInvoiceMutation.mutateAsync({ id: invoice.id, data: updatedData });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/invoices/${invoice.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Invoice</h1>
          <p className="text-gray-500 dark:text-gray-400">{invoice.invoiceNumber}</p>
        </div>
      </div>

      {/* Customer & Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={[
                { value: '', label: 'Select a customer...' },
                ...customers.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Input
              label="Invoice Number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
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
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'sent', label: 'Sent' },
                { value: 'viewed', label: 'Viewed' },
                { value: 'partial', label: 'Partial Payment' },
                { value: 'paid', label: 'Paid' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
          <Input
            label="Customer PO Number (optional)"
            value={customerPONumber}
            onChange={(e) => setCustomerPONumber(e.target.value)}
            placeholder="Enter customer's purchase order number"
          />
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
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
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
                  <div className="relative">
                    <Input
                      placeholder="Description or select product..."
                      value={item.description}
                      onChange={(e) => handleItemChange(item.id!, 'description', e.target.value)}
                    />
                    {products.length > 0 && (
                      <select
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 bg-transparent border-none cursor-pointer"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleProductSelect(item.id!, e.target.value);
                          }
                        }}
                        value=""
                      >
                        <option value="">Select...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
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
                    min="0"
                    value={item.unitPrice || ''}
                    placeholder="0.00"
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
                  {fc(item.total || 0)}
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

      {/* Discount, Totals & Notes */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Discount */}
          <Card>
            <CardHeader>
              <CardTitle>Discount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <Select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percentage')}
                  options={[
                    { value: 'fixed', label: 'J$' },
                    { value: 'percentage', label: '%' },
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes visible to customer..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Payment terms, conditions, etc..."
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
              <span className="font-medium">{fc(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">GCT</span>
              <span className="font-medium">{fc(gctAmount)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Discount</span>
                <span className="font-medium text-red-600">-{fc(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-emerald-600">{fc(total)}</span>
            </div>
            {Number(invoice.amountPaid) > 0 && (
              <>
                <div className="flex justify-between pt-2">
                  <span className="text-gray-500 dark:text-gray-400">Amount Paid</span>
                  <span className="font-medium text-emerald-600">-{fc(Number(invoice.amountPaid))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Balance Due</span>
                  <span className="text-lg font-bold text-orange-600">
                    {fc(Math.max(total - Number(invoice.amountPaid), 0))}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href={`/invoices/${invoice.id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
