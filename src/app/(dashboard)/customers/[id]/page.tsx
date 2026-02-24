'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { PermissionGate } from '@/components/PermissionGate';
import { useAppStore } from '@/store/appStore';
import { formatJMD, formatDate } from '@/lib/utils';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params?.id as string;

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { customers, invoices, deleteCustomer } = useAppStore();

  const customer = customers.find((c) => c.id === customerId);

  // Get customer's invoices
  const customerInvoices = invoices
    .filter((inv) => inv.customerId === customerId)
    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

  const handleDelete = () => {
    if (customer) {
      deleteCustomer(customer.id);
      router.push('/customers');
    }
  };

  if (!customer) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">Customer not found</p>
            <Button onClick={() => router.push('/customers')}>
              Back to Customers
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const stats = {
    totalInvoices: customerInvoices.length,
    paidInvoices: customerInvoices.filter((inv) => inv.status === 'paid').length,
    totalSales: customerInvoices.reduce((sum, inv) => sum + inv.total, 0),
    outstandingBalance: customer.balance,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            icon={<ArrowLeftIcon className="w-4 h-4" />}
          >
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
              <Badge
                variant={
                  customer.type === 'customer'
                    ? 'success'
                    : customer.type === 'vendor'
                    ? 'info'
                    : 'default'
                }
              >
                {customer.type}
              </Badge>
            </div>
            {customer.companyName && (
              <p className="text-gray-500">{customer.companyName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <PermissionGate permission="customers.edit">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/customers/${customer.id}/edit`)}
              icon={<PencilIcon className="w-4 h-4" />}
            >
              Edit
            </Button>
          </PermissionGate>
          <PermissionGate permission="customers.delete">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              icon={<TrashIcon className="w-4 h-4 text-red-500" />}
            >
              Delete
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Paid Invoices</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.paidInvoices}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Sales</p>
            <p className="text-2xl font-bold text-blue-600">{formatJMD(stats.totalSales)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Balance</p>
            <p className={`text-2xl font-bold ${stats.outstandingBalance > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
              {formatJMD(stats.outstandingBalance)}
            </p>
          </div>
        </Card>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-3">
                  <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    {customer.email}
                  </a>
                </div>
              )}
              
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <PhoneIcon className="w-5 h-5 text-gray-400" />
                  <a
                    href={`tel:${customer.phone}`}
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    {customer.phone}
                  </a>
                </div>
              )}

              {customer.address && (
                <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="text-gray-700">
                    {typeof customer.address === 'string' ? (
                      <p>{customer.address}</p>
                    ) : (
                      <>
                        {customer.address.street && <p>{customer.address.street}</p>}
                        <p>
                          {[customer.address.city, customer.address.parish]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        {customer.address.country && <p>{customer.address.country}</p>}
                      </>
                    )}
                  </div>
                </div>
              )}

              {!customer.email && !customer.phone && !customer.address && (
                <p className="text-gray-400 text-sm">No contact information provided</p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h2>
            <div className="space-y-3">
              {customer.trnNumber && (
                <div>
                  <p className="text-sm text-gray-500">TRN Number</p>
                  <p className="font-medium text-gray-900">{customer.trnNumber}</p>
                </div>
              )}

              {customer.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-gray-700">{customer.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-gray-700">{formatDate(customer.createdAt)}</p>
              </div>

              {!customer.trnNumber && !customer.notes && (
                <p className="text-gray-400 text-sm">No business details provided</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Purchase History */}
      <Card padding="none">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Purchase History</h2>
          </div>
        </div>

        {customerInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">No invoices found for this customer</p>
            <Button onClick={() => router.push('/invoices/new')}>
              Create First Invoice
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerInvoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                >
                  <TableCell className="font-medium text-emerald-600">
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                  <TableCell>{formatJMD(invoice.total)}</TableCell>
                  <TableCell>{formatJMD(invoice.amountPaid)}</TableCell>
                  <TableCell
                    className={invoice.balance > 0 ? 'text-orange-600 font-medium' : ''}
                  >
                    {formatJMD(invoice.balance)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        invoice.status === 'paid'
                          ? 'success'
                          : invoice.status === 'overdue'
                          ? 'danger'
                          : invoice.status === 'partial'
                          ? 'warning'
                          : 'default'
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Customer"
      >
        <ModalBody>
          <div className="space-y-3">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{customer.name}</strong>?
            </p>
            {customerInvoices.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  ⚠️ This customer has {customerInvoices.length} invoice(s) on record. Deleting them will not delete their invoices.
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete Customer
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
