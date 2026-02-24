'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Card, Button, Input, StatusBadge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter, Textarea } from '@/components/ui';
import { useInvoices, useUpdateInvoice, useCustomers } from '@/hooks/api';
import { api } from '@/lib/api-client';
import { formatJMD, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { PermissionGate } from '@/components/PermissionGate';

export default function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  // API hooks
  const { data: invoicesResponse, isLoading } = useInvoices({ limit: 200 });
  const { data: customersResponse } = useCustomers({ limit: 200 });
  const updateInvoiceMutation = useUpdateInvoice();
  const invoices: Invoice[] = (invoicesResponse as any)?.data ?? [];
  const customers: any[] = (customersResponse as any)?.data ?? [];

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = !searchQuery ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ['all', 'draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'];

  const stats = {
    total: invoices.length,
    outstanding: invoices.filter(i => !['paid', 'cancelled'].includes(i.status)).reduce((sum, i) => sum + i.balance, 0),
    overdue: invoices.filter(i => i.status === 'overdue').length,
    paidThisMonth: invoices.filter(i => {
      const paidDate = i.paidDate ? new Date(i.paidDate) : null;
      const now = new Date();
      return paidDate && paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    }).reduce((sum, i) => sum + i.total, 0),
  };

  const handleOpenEmailModal = (invoice: Invoice) => {
    const customer = invoice.customer || customers.find((c) => c.id === invoice.customerId);
    setSelectedInvoice(invoice);
    setEmailTo(customer?.email || '');
    setEmailSubject(`Invoice ${invoice.invoiceNumber} from YaadBooks`);
    setEmailMessage(`Dear ${customer?.name || 'Valued Customer'},

Please find attached invoice ${invoice.invoiceNumber} for ${formatJMD(invoice.total)}.

Payment is due by ${format(new Date(invoice.dueDate), 'MMMM dd, yyyy')}.

Thank you for your business!

Best regards,
YaadBooks`);
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo || !selectedInvoice) {
      alert('Please enter an email address');
      return;
    }

    setEmailSending(true);
    try {
      await api.post(`/api/v1/invoices/${selectedInvoice.id}/send`, {
        to: emailTo,
        subject: emailSubject,
        message: emailMessage,
      });

      setShowEmailModal(false);
      setSelectedInvoice(null);
      alert(`Invoice sent to ${emailTo}`);
    } catch (err: any) {
      alert(err.message || 'Failed to send invoice');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500">Manage your sales invoices</p>
        </div>
        <PermissionGate permission="invoices:create">
          <Link href="/invoices/new">
            <Button icon={<PlusIcon className="w-4 h-4" />}>
              New Invoice
            </Button>
          </Link>
        </PermissionGate>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Outstanding</p>
            <p className="text-2xl font-bold text-orange-600">{formatJMD(stats.outstanding)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Paid This Month</p>
            <p className="text-2xl font-bold text-emerald-600">{formatJMD(stats.paidThisMonth)}</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search invoices..."
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

      {/* Invoices Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                  <p className="mb-4">No invoices found</p>
                  <Link href="/invoices/new">
                    <Button>Create your first invoice</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>
                    {invoice.customer?.name || customers.find(c => c.id === invoice.customerId)?.name || 'Unknown'}
                  </TableCell>
                  <TableCell className="text-gray-500">{formatDate(invoice.issueDate)}</TableCell>
                  <TableCell className="text-gray-500">{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell className="font-medium">{formatJMD(invoice.total)}</TableCell>
                  <TableCell className={invoice.balance > 0 ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                    {formatJMD(invoice.balance)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="sm">
                          <EyeIcon className="w-4 h-4" />
                        </Button>
                      </Link>
                      <PermissionGate permission="invoices:update">
                        <Link href={`/invoices/${invoice.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                        </Link>
                      </PermissionGate>
                      <PermissionGate permission="invoices:update">
                        <Button variant="ghost" size="sm" title="Send" onClick={() => handleOpenEmailModal(invoice)}>
                          <EnvelopeIcon className="w-4 h-4" />
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
            {selectedInvoice && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Attachment:</strong> Invoice {selectedInvoice.invoiceNumber} (PDF)
                </p>
              </div>
            )}
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
    </div>
  );
}
