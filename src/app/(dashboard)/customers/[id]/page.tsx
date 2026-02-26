'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { PermissionGate } from '@/components/PermissionGate';
import { useCustomer, useDeleteCustomer } from '@/hooks/api/useCustomers';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
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
  const { fc } = useCurrency();
  const router = useRouter();
  const params = useParams();
  const customerId = params?.id as string;

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: customerData, isLoading } = useCustomer(customerId);
  const deleteCustomerMutation = useDeleteCustomer();

  // The API returns customer data - handle both direct and nested response shapes
  const customer = (customerData as any)?.data ?? customerData;

  const handleDelete = async () => {
    if (customer) {
      try {
        await deleteCustomerMutation.mutateAsync(customer.id);
        router.push('/customers');
      } catch {
        // handled by React Query
      }
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <div className="p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <div className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Customer not found</p>
            <Button onClick={() => router.push('/customers')}>
              Back to Customers
            </Button>
          </div>
        </Card>
      </div>
    );
  }

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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{customer.name}</h1>
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
              <p className="text-gray-500 dark:text-gray-400">{customer.companyName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <PermissionGate permission="customers:update">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/customers/${customer.id}/edit`)}
              icon={<PencilIcon className="w-4 h-4" />}
            >
              Edit
            </Button>
          </PermissionGate>
          <PermissionGate permission="customers:delete">
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{customer.type}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <p className="text-2xl font-bold text-emerald-600">
              {customer.isActive !== false ? 'Active' : 'Inactive'}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Balance</p>
            <p className={`text-2xl font-bold ${(customer.balance || 0) > 0 ? 'text-orange-600' : 'text-gray-900 dark:text-white'}`}>
              {fc(customer.balance || 0)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Customer Since</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {customer.createdAt ? formatDate(customer.createdAt) : 'N/A'}
            </p>
          </div>
        </Card>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h2>
            <div className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-3">
                  <EnvelopeIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
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
                  <PhoneIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <a
                    href={`tel:${customer.phone}`}
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    {customer.phone}
                  </a>
                </div>
              )}

              {(customer.addressStreet || customer.addressCity || customer.addressParish) && (
                <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  <div className="text-gray-700 dark:text-gray-300">
                    {customer.addressStreet && <p>{customer.addressStreet}</p>}
                    <p>
                      {[customer.addressCity, customer.addressParish]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {customer.addressCountry && <p>{customer.addressCountry}</p>}
                  </div>
                </div>
              )}

              {!customer.email && !customer.phone && !customer.addressStreet && !customer.addressCity && !customer.addressParish && (
                <p className="text-gray-400 dark:text-gray-500 text-sm">No contact information provided</p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Business Details</h2>
            <div className="space-y-3">
              {customer.trnNumber && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">TRN Number</p>
                  <p className="font-medium text-gray-900 dark:text-white">{customer.trnNumber}</p>
                </div>
              )}

              {customer.notes && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                  <p className="text-gray-700 dark:text-gray-300">{customer.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                <p className="text-gray-700 dark:text-gray-300">
                  {customer.createdAt ? formatDate(customer.createdAt) : 'N/A'}
                </p>
              </div>

              {!customer.trnNumber && !customer.notes && (
                <p className="text-gray-400 dark:text-gray-500 text-sm">No business details provided</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <DocumentTextIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/invoices/new?customerId=${customer.id}`)}
            >
              Create Invoice
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/customers/statements?id=${customer.id}`)}
            >
              View Statement
            </Button>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Customer"
      >
        <ModalBody>
          <div className="space-y-3">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{customer.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleteCustomerMutation.isPending}
          >
            {deleteCustomerMutation.isPending ? 'Deleting...' : 'Delete Customer'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
