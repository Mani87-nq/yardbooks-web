'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Select, Textarea, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { useAppStore, useActiveCustomers, useActiveProducts } from '@/store/appStore';
import { GCT_RATES } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useCreateInvoice } from '@/hooks/api/useInvoices';
import { useCreateCustomer } from '@/hooks/api/useCustomers';
import { v4 as uuidv4 } from 'uuid';
import type { Invoice, InvoiceItem, GCTRate } from '@/types';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api-client';

export default function NewInvoicePage() {
  const { fc } = useCurrency();
  const router = useRouter();
  const { activeCompany, settings, addCustomer } = useAppStore();
  const customers = useActiveCustomers();
  const products = useActiveProducts();
  const createInvoice = useCreateInvoice();
  const createCustomer = useCreateCustomer();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState('');

  // Send email modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  // Inline customer creation state
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [newCustomerErrors, setNewCustomerErrors] = useState<Record<string, string>>({});

  const handleNewCustomerPhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      setNewCustomerForm((f) => ({ ...f, phone: cleaned }));
    } else if (cleaned.length <= 6) {
      setNewCustomerForm((f) => ({ ...f, phone: `${cleaned.slice(0, 3)}-${cleaned.slice(3)}` }));
    } else if (cleaned.length <= 10) {
      setNewCustomerForm((f) => ({ ...f, phone: `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}` }));
    }
  };

  const handleCreateCustomer = async () => {
    // Validate
    const errors: Record<string, string> = {};
    if (!newCustomerForm.name.trim()) {
      errors.name = 'Name is required';
    }
    if (newCustomerForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomerForm.email)) {
      errors.email = 'Invalid email format';
    }
    if (newCustomerForm.phone) {
      const phonePattern = /^876-?\d{3}-?\d{4}$/;
      if (!phonePattern.test(newCustomerForm.phone.replace(/\s/g, ''))) {
        errors.phone = 'Phone must be in 876-XXX-XXXX format';
      }
    }
    setNewCustomerErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const result = await createCustomer.mutateAsync({
        name: newCustomerForm.name.trim(),
        email: newCustomerForm.email.trim() || null,
        phone: newCustomerForm.phone.trim() || null,
        type: 'customer',
      });

      // Add to local store so the dropdown updates immediately
      const created = result as any;
      addCustomer({
        id: created.id,
        companyId: activeCompany?.id || '',
        type: created.type?.toLowerCase() || 'customer',
        name: created.name,
        companyName: created.companyName || undefined,
        email: created.email || undefined,
        phone: created.phone || undefined,
        trnNumber: created.trnNumber || undefined,
        balance: 0,
        createdAt: new Date(created.createdAt),
        updatedAt: new Date(created.updatedAt || created.createdAt),
      });

      // Auto-select the newly created customer
      setCustomerId(created.id);

      // Reset and close modal
      setNewCustomerForm({ name: '', email: '', phone: '' });
      setNewCustomerErrors({});
      setShowNewCustomerModal(false);
    } catch {
      setNewCustomerErrors({ form: 'Failed to create customer. Please try again.' });
    }
  };
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const defaultGctRate: GCTRate = activeCompany?.gctRegistered ? 'standard' as GCTRate : 'exempt' as GCTRate;
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([
    { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, gctRate: defaultGctRate, gctAmount: 0, total: 0 },
  ]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, gctRate: defaultGctRate, gctAmount: 0, total: 0 },
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

  const validateForm = (): boolean => {
    if (!customerId) {
      alert('Please select a customer');
      return false;
    }
    const emptyItems = items.filter((item) => !item.description?.trim());
    if (emptyItems.length > 0) {
      alert('Each line item must have a description. Please fill in all descriptions or remove empty items.');
      return false;
    }
    const zeroQtyItems = items.filter((item) => !item.quantity || item.quantity <= 0);
    if (zeroQtyItems.length > 0) {
      alert('Each line item must have a quantity greater than zero.');
      return false;
    }
    if (!issueDate) { alert('Please set an issue date.'); return false; }
    if (!dueDate) { alert('Please set a due date.'); return false; }
    return true;
  };

  const handleSubmit = async (status: 'draft' | 'sent') => {
    if (!validateForm()) return;
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const invoiceData = {
        customerId,
        items: (items as InvoiceItem[]).map(({ id, ...item }) => ({
          ...item,
          gctRate: (item.gctRate || 'standard').toUpperCase(),
        })),
        subtotal,
        gctAmount,
        discount: 0,
        discountType: 'FIXED' as const,
        total,
        // When "Create & Send" is clicked, create as DRAFT first — only mark SENT after email succeeds
        status: status === 'sent' ? 'DRAFT' : status.toUpperCase(),
        issueDate: new Date(issueDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        notes: notes || undefined,
      };

      const result = await createInvoice.mutateAsync(invoiceData);

      if (status === 'sent') {
        // Show email modal instead of immediately marking as sent
        const selectedCustomer = customers.find((c) => c.id === customerId);
        setSendEmail(selectedCustomer?.email || '');
        setSendMessage(`Please find attached invoice for ${fc(total)}. Payment is due by ${new Date(dueDate).toLocaleDateString()}.`);
        setCreatedInvoiceId((result as any)?.id || (result as any)?.data?.id);
        setShowSendModal(true);
      } else {
        router.push('/invoices');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create invoice';
      alert(message.includes('Validation failed')
        ? 'Please check that all fields are filled in correctly: customer selected, items have descriptions and quantities, and dates are valid.'
        : message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!createdInvoiceId || !sendEmail) {
      alert('Please enter a recipient email address.');
      return;
    }
    setIsSending(true);
    try {
      await api.post(`/api/v1/invoices/${createdInvoiceId}/send`, {
        recipientEmail: sendEmail,
        subject: `Invoice from ${activeCompany?.businessName || 'YaadBooks'}`,
        message: sendMessage,
      });
      setShowSendModal(false);
      router.push('/invoices');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      alert(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSkipSend = () => {
    setShowSendModal(false);
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
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                label="Customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                options={[
                  { value: '', label: 'Select a customer...' },
                  ...customers.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowNewCustomerModal(true)}
              className="mb-[1px] shrink-0"
            >
              <UserPlusIcon className="w-4 h-4 mr-1" />
              New Customer
            </Button>
          </div>
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
            <div className={`grid ${activeCompany?.gctRegistered ? 'grid-cols-12' : 'grid-cols-10'} gap-2 text-xs font-medium text-gray-500 uppercase`}>
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Price</div>
              {activeCompany?.gctRegistered && <div className="col-span-2">GCT</div>}
              <div className="col-span-2 text-right">Total</div>
            </div>

            {/* Items */}
            {items.map((item) => (
              <div key={item.id} className={`grid ${activeCompany?.gctRegistered ? 'grid-cols-12' : 'grid-cols-10'} gap-2 items-center`}>
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
                    min="0"
                    value={item.unitPrice || ''}
                    placeholder="0.00"
                    onChange={(e) => handleItemChange(item.id!, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                </div>
                {activeCompany?.gctRegistered && (
                <div className="col-span-2">
                  <Select
                    value={item.gctRate}
                    onChange={(e) => handleItemChange(item.id!, 'gctRate', e.target.value)}
                    options={[
                      { value: 'standard', label: '15%' },
                      { value: 'tourism', label: '10%' },
                      { value: 'telecom', label: '25%' },
                      { value: 'zero_rated', label: '0%' },
                      { value: 'exempt', label: 'Exempt' },
                    ]}
                  />
                </div>
                )}
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
              <span className="font-medium">{fc(subtotal)}</span>
            </div>
            {activeCompany?.gctRegistered && (
              <div className="flex justify-between">
                <span className="text-gray-500">GCT</span>
                <span className="font-medium">{fc(gctAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-emerald-600">{fc(total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href="/invoices">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button variant="secondary" onClick={() => handleSubmit('draft')} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button onClick={() => handleSubmit('sent')} disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create & Send'}
        </Button>
      </div>

      {/* Inline New Customer Modal */}
      <Modal
        isOpen={showNewCustomerModal}
        onClose={() => {
          setShowNewCustomerModal(false);
          setNewCustomerForm({ name: '', email: '', phone: '' });
          setNewCustomerErrors({});
        }}
        title="Quick Add Customer"
        description="Create a new customer without leaving the invoice form."
        size="sm"
      >
        <ModalBody className="space-y-4">
          {newCustomerErrors.form && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{newCustomerErrors.form}</p>
          )}
          <Input
            label="Name *"
            placeholder="Full name or business name"
            value={newCustomerForm.name}
            onChange={(e) => setNewCustomerForm((f) => ({ ...f, name: e.target.value }))}
            error={newCustomerErrors.name}
            autoFocus
          />
          <Input
            label="Email"
            type="email"
            placeholder="email@example.com"
            value={newCustomerForm.email}
            onChange={(e) => setNewCustomerForm((f) => ({ ...f, email: e.target.value }))}
            error={newCustomerErrors.email}
          />
          <Input
            label="Phone"
            type="tel"
            placeholder="876-XXX-XXXX"
            value={newCustomerForm.phone}
            onChange={(e) => handleNewCustomerPhoneChange(e.target.value)}
            error={newCustomerErrors.phone}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowNewCustomerModal(false);
              setNewCustomerForm({ name: '', email: '', phone: '' });
              setNewCustomerErrors({});
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateCustomer}
            disabled={createCustomer.isPending}
          >
            {createCustomer.isPending ? 'Creating...' : 'Create Customer'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Send Invoice Email Modal */}
      <Modal
        isOpen={showSendModal}
        onClose={handleSkipSend}
        title="Send Invoice"
        description="Email this invoice to your customer. You can also skip and send later from the invoice list."
        size="md"
      >
        <ModalBody className="space-y-4">
          <Input
            label="Recipient Email *"
            type="email"
            placeholder="customer@example.com"
            value={sendEmail}
            onChange={(e) => setSendEmail(e.target.value)}
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            autoFocus
          />
          <Textarea
            label="Message (optional)"
            placeholder="Add a personal note..."
            value={sendMessage}
            onChange={(e) => setSendMessage(e.target.value)}
            rows={3}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={handleSkipSend}>
            Skip — Send Later
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={isSending || !sendEmail}
          >
            {isSending ? 'Sending...' : 'Send Invoice'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
