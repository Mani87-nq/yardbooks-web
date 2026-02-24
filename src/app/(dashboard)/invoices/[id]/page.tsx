'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, ModalBody, ModalFooter, Input, Textarea } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatJMD } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { useInvoice, useUpdateInvoice, useDeleteInvoice } from '@/hooks/api/useInvoices';
import { printContent, generateTable, formatPrintCurrency } from '@/lib/print';
import {
  ArrowLeftIcon,
  PencilIcon,
  PrinterIcon,
  EnvelopeIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  BanknotesIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function InvoiceDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: invoice, isLoading: isFetchingInvoice, refetch: refetchInvoice } = useInvoice(id);
  const updateInvoiceMutation = useUpdateInvoice();
  const deleteInvoiceMutation = useDeleteInvoice();
  const { activeCompany } = useAppStore();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [emailSending, setEmailSending] = useState(false);

  if (isFetchingInvoice) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Invoice Not Found</h2>
        <Link href="/invoices" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Back to Invoices
        </Link>
      </div>
    );
  }

  const customer = invoice.customer;

  const handleOpenEmailModal = () => {
    setEmailTo(customer?.email || '');
    setEmailSubject(`Invoice ${invoice.invoiceNumber} from ${activeCompany?.businessName || 'YaadBooks'}`);
    setEmailMessage(`Dear ${customer?.name || 'Valued Customer'},

Please find attached invoice ${invoice.invoiceNumber} for ${formatJMD(invoice.total)}.

Payment is due by ${format(new Date(invoice.dueDate), 'MMMM dd, yyyy')}.

Thank you for your business!

Best regards,
${activeCompany?.businessName || 'YaadBooks'}`);
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo) {
      alert('Please enter an email address');
      return;
    }

    setEmailSending(true);

    try {
      await api.post(`/api/v1/invoices/${invoice.id}/send`, {
        to: emailTo,
        subject: emailSubject,
        message: emailMessage,
      });

      if (invoice.status === 'DRAFT' || invoice.status === 'draft') {
        await updateInvoiceMutation.mutateAsync({ id: invoice.id, data: { status: 'SENT' } });
      }

      setShowEmailModal(false);
      alert(`Invoice sent to ${emailTo}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send invoice');
    } finally {
      setEmailSending(false);
    }
  };

  const [recordingPayment, setRecordingPayment] = useState(false);
  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }
    const currentBalance = Number(invoice.balance);
    if (amount > currentBalance) {
      alert('Payment amount cannot exceed balance');
      return;
    }

    setRecordingPayment(true);
    try {
      await api.post(`/api/v1/invoices/${invoice.id}/payments`, {
        amount,
        paymentMethod: paymentMethod.toUpperCase(),
        date: paymentDate || new Date().toISOString(),
        reference: '',
      });
      setShowPaymentModal(false);
      setPaymentAmount('');
      // Refetch invoice to get updated balance/status
      refetchInvoice();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleDeleteInvoice = async () => {
    try {
      await deleteInvoiceMutation.mutateAsync(invoice.id);
      window.location.href = '/invoices';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete invoice');
    }
  };

  const handlePrintInvoice = () => {
    const itemsTable = generateTable(
      [
        { key: 'description', label: 'Description' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'unitPrice', label: 'Unit Price', align: 'right' },
        { key: 'gct', label: 'GCT', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
      invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gct: item.gctAmount,
        total: item.total,
      })),
      {
        formatters: {
          unitPrice: formatPrintCurrency,
          gct: formatPrintCurrency,
          total: formatPrintCurrency,
        },
      }
    );

    const invoiceSettings = activeCompany?.invoiceSettings;
    const primaryColor = invoiceSettings?.primaryColor || '#059669';

    const headerSection = `
      <div style="display:flex;justify-content:space-between;margin-bottom:30px;">
        <div>
          <h2 style="color:${primaryColor};font-size:24px;margin:0;">INVOICE</h2>
          <p style="font-size:18px;font-weight:600;margin:5px 0;">${invoice.invoiceNumber}</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:12px;color:#6b7280;margin:2px 0;">Issue Date: ${format(new Date(invoice.issueDate), 'MMM dd, yyyy')}</p>
          <p style="font-size:12px;color:#6b7280;margin:2px 0;">Due Date: ${format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</p>
          <p style="font-size:14px;font-weight:500;margin-top:5px;color:${invoice.status.toUpperCase() === 'PAID' ? '#16a34a' : invoice.status.toUpperCase() === 'OVERDUE' ? '#dc2626' : '#6b7280'};">
            Status: ${invoice.status.toUpperCase()}
          </p>
        </div>
      </div>
    `;

    const billToSection = `
      <div style="margin-bottom:20px;padding:15px;background:#f9fafb;border-radius:8px;">
        <p style="font-size:12px;color:#6b7280;margin:0 0 5px;">Bill To:</p>
        <p style="font-size:16px;font-weight:600;margin:0;">${customer?.name || 'N/A'}</p>
        ${customer?.email ? `<p style="font-size:13px;color:#374151;margin:3px 0;">${customer.email}</p>` : ''}
        ${customer?.phone ? `<p style="font-size:13px;color:#374151;margin:3px 0;">${customer.phone}</p>` : ''}
        ${customer?.address ? `<p style="font-size:13px;color:#374151;margin:3px 0;">${typeof customer.address === 'string' ? customer.address : `${customer.address.street}, ${customer.address.city}`}</p>` : ''}
      </div>
    `;

    const totalsSection = `
      <div style="margin-top:20px;margin-left:auto;width:250px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;">Subtotal</td><td style="padding:8px 0;text-align:right;">${formatPrintCurrency(invoice.subtotal)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">GCT</td><td style="padding:8px 0;text-align:right;">${formatPrintCurrency(invoice.gctAmount)}</td></tr>
          ${invoice.discount > 0 ? `<tr><td style="padding:8px 0;color:#6b7280;">Discount</td><td style="padding:8px 0;text-align:right;color:#dc2626;">-${formatPrintCurrency(invoice.discount)}</td></tr>` : ''}
          <tr style="border-top:2px solid #e5e7eb;"><td style="padding:12px 0;font-weight:700;font-size:16px;">Total</td><td style="padding:12px 0;text-align:right;font-weight:700;font-size:16px;color:${primaryColor};">${formatPrintCurrency(invoice.total)}</td></tr>
          ${invoice.amountPaid > 0 ? `<tr><td style="padding:8px 0;color:#6b7280;">Amount Paid</td><td style="padding:8px 0;text-align:right;color:#16a34a;">-${formatPrintCurrency(invoice.amountPaid)}</td></tr>` : ''}
          ${invoice.balance > 0 ? `<tr style="background:#fef3c7;"><td style="padding:12px 8px;font-weight:600;">Balance Due</td><td style="padding:12px 8px;text-align:right;font-weight:700;color:#d97706;">${formatPrintCurrency(invoice.balance)}</td></tr>` : ''}
        </table>
      </div>
    `;

    const notesSection = invoice.notes ? `
      <div style="margin-top:30px;padding:15px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
        <p style="font-size:12px;font-weight:600;color:#166534;margin:0 0 5px;">Notes:</p>
        <p style="font-size:13px;color:#374151;margin:0;white-space:pre-wrap;">${invoice.notes}</p>
      </div>
    ` : '';

    const footerSection = invoiceSettings?.footer ? `
      <div style="margin-top:30px;text-align:center;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="font-size:12px;color:#6b7280;">${invoiceSettings.footer}</p>
      </div>
    ` : '';

    printContent({
      title: '',
      companyName: activeCompany?.businessName,
      content: headerSection + billToSection + '<h3 style="margin:20px 0 10px;font-weight:600;font-size:14px;">Items</h3>' + itemsTable + totalsSection + notesSection + footerSection,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'success';
      case 'sent':
      case 'viewed':
        return 'info';
      case 'partial':
        return 'warning';
      case 'overdue':
        return 'danger';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
              <Badge variant={getStatusColor(invoice.status)}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).toLowerCase()}
              </Badge>
            </div>
            <p className="text-gray-500">{customer?.name || 'Unknown Customer'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrintInvoice}>
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleOpenEmailModal}>
            <EnvelopeIcon className="w-4 h-4 mr-2" />
            Email
          </Button>
          <Link href={`/invoices/${invoice.id}/edit`}>
            <Button variant="outline">
              <PencilIcon className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
          {invoice.balance > 0 && (
            <Button onClick={() => {
              setPaymentAmount(invoice.balance.toString());
              setShowPaymentModal(true);
            }}>
              <BanknotesIcon className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{formatJMD(invoice.total)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Paid</p>
            <p className="text-2xl font-bold text-emerald-600">{formatJMD(invoice.amountPaid)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Balance</p>
            <p className={`text-2xl font-bold ${invoice.balance > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {formatJMD(invoice.balance)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Due Date</p>
            <p className={`text-lg font-semibold ${invoice.status.toUpperCase() === 'OVERDUE' ? 'text-red-600' : 'text-gray-900'}`}>
              {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
            </p>
          </div>
        </Card>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bill To */}
        <Card>
          <CardHeader>
            <CardTitle>Bill To</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="font-semibold text-gray-900">{customer?.name || 'N/A'}</p>
              {customer?.email && <p className="text-sm text-gray-600">{customer.email}</p>}
              {customer?.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
              {customer?.address && (
                <p className="text-sm text-gray-600">
                  {typeof customer.address === 'string'
                    ? customer.address
                    : `${customer.address.street}, ${customer.address.city}, ${customer.address.parish}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoice Info */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice #</span>
                <span className="font-medium">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Issue Date</span>
                <span className="font-medium">{format(new Date(invoice.issueDate), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Due Date</span>
                <span className="font-medium">{format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</span>
              </div>
              {invoice.customerPONumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">PO Number</span>
                  <span className="font-medium">{invoice.customerPONumber}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatJMD(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GCT (15%)</span>
                <span className="font-medium">{formatJMD(invoice.gctAmount)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Discount</span>
                  <span className="font-medium text-red-600">-{formatJMD(invoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-emerald-600">{formatJMD(invoice.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium text-right">Qty</th>
                  <th className="pb-3 font-medium text-right">Unit Price</th>
                  <th className="pb-3 font-medium text-right">GCT</th>
                  <th className="pb-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 text-gray-900">{item.description}</td>
                    <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-600">{formatJMD(item.unitPrice)}</td>
                    <td className="py-3 text-right text-gray-600">{formatJMD(item.gctAmount)}</td>
                    <td className="py-3 text-right font-medium text-gray-900">{formatJMD(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => setShowDeleteModal(true)}>
          <TrashIcon className="w-4 h-4 mr-2" />
          Delete Invoice
        </Button>
        <div className="flex gap-2">
          <Link href={`/invoices/${invoice.id}/edit`}>
            <Button variant="outline">
              <PencilIcon className="w-4 h-4 mr-2" />
              Edit Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Email Modal */}
      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} title="Send Invoice" size="lg">
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="To"
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="customer@email.com"
            />
            <Input
              label="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <Textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={8}
              />
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Attachment:</strong> Invoice {invoice.invoiceNumber} (PDF)
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowEmailModal(false)}>Cancel</Button>
          <Button onClick={handleSendEmail} disabled={emailSending}>
            {emailSending ? (
              <>Sending...</>
            ) : (
              <>
                <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                Send Invoice
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment">
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Invoice Total</span>
                <span className="font-medium">{formatJMD(invoice.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Balance Due</span>
                <span className="font-bold text-orange-600">{formatJMD(invoice.balance)}</span>
              </div>
            </div>
            <Input
              label="Payment Amount"
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
            />
            <Input
              label="Payment Date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
          <Button onClick={handleRecordPayment}>
            <CheckCircleIcon className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Invoice">
        <ModalBody>
          <p className="text-gray-600">
            Are you sure you want to delete invoice <strong>{invoice.invoiceNumber}</strong>? This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteInvoice}>
            <TrashIcon className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
