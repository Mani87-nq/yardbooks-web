'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PencilIcon,
  XMarkIcon,
  DocumentPlusIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api-client';
import type { CustomerPurchaseOrder, CustomerPOStatus } from '@/types/customerPO';
import {
  CUSTOMER_PO_STATUS_LABELS,
  calculatePOProgress,
  canCreateInvoiceFromPO,
  canEditPO,
  canCancelPO,
} from '@/types/customerPO';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerPODetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [po, setPO] = useState<CustomerPurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchPO = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<CustomerPurchaseOrder>(`/api/v1/customer-pos/${id}`);
      setPO(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPO();
  }, [fetchPO]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Loading purchase order...</p>
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <DocumentTextIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {error || 'PO Not Found'}
        </h2>
        <p className="text-gray-500 mb-4">The purchase order you are looking for doesn't exist or could not be loaded.</p>
        <Link
          href="/customer-po"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Back to POs
        </Link>
      </div>
    );
  }

  const progress = calculatePOProgress(po.totalOrderedQuantity, po.totalInvoicedQuantity);

  const getStatusColor = (status: CustomerPOStatus) => {
    const colors: Record<CustomerPOStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      open: 'bg-blue-100 text-blue-700',
      partially_invoiced: 'bg-orange-100 text-orange-700',
      fully_invoiced: 'bg-green-100 text-green-700',
      closed: 'bg-slate-100 text-slate-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status];
  };

  const handleStatusChange = async (newStatus: CustomerPOStatus) => {
    setUpdating(true);
    try {
      await api.put(`/api/v1/customer-pos/${po.id}`, { status: newStatus });
      fetchPO();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateInvoice = () => {
    router.push(`/invoices/new?poId=${po.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/customer-po"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{po.poNumber}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                {CUSTOMER_PO_STATUS_LABELS[po.status]}
              </span>
            </div>
            <p className="text-gray-500">{po.customer?.name || 'Unknown Customer'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEditPO(po.status) && (
            <Link
              href={`/customer-po/${po.id}/edit`}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <PencilIcon className="w-4 h-4" />
              Edit
            </Link>
          )}
          {canCreateInvoiceFromPO(po.status) && (
            <button
              onClick={handleCreateInvoice}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <DocumentPlusIcon className="w-4 h-4" />
              Create Invoice
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Invoicing Progress</h2>
          <span className="text-2xl font-bold text-gray-900">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-orange-500' : 'bg-gray-300'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-3 text-sm">
          <div>
            <span className="text-gray-500">Ordered:</span>
            <span className="font-medium text-gray-900 ml-1">{po.totalOrderedQuantity}</span>
          </div>
          <div>
            <span className="text-gray-500">Invoiced:</span>
            <span className="font-medium text-green-600 ml-1">{po.totalInvoicedQuantity}</span>
          </div>
          <div>
            <span className="text-gray-500">Remaining:</span>
            <span className="font-medium text-orange-600 ml-1">{po.totalRemainingQuantity}</span>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium text-right">Ordered</th>
                    <th className="pb-3 font-medium text-right">Invoiced</th>
                    <th className="pb-3 font-medium text-right">Remaining</th>
                    <th className="pb-3 font-medium text-right">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {po.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-3 text-gray-500">{index + 1}</td>
                      <td className="py-3">
                        <span className="font-medium text-gray-900">{item.description}</span>
                        {item.notes && (
                          <p className="text-sm text-gray-500">{item.notes}</p>
                        )}
                      </td>
                      <td className="py-3 text-right text-gray-900">
                        {item.orderedQuantity} {item.uomShortCode}
                      </td>
                      <td className="py-3 text-right text-green-600">
                        {item.invoicedQuantity} {item.uomShortCode}
                      </td>
                      <td className="py-3 text-right">
                        <span className={item.remainingQuantity > 0 ? 'text-orange-600' : 'text-gray-500'}>
                          {item.remainingQuantity} {item.uomShortCode}
                        </span>
                      </td>
                      <td className="py-3 text-right text-gray-900">
                        {item.agreedUnitPrice ? `$${item.agreedUnitPrice.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {(po.notes || po.internalNotes) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Notes</h2>
              {po.notes && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Customer Notes</h3>
                  <p className="text-gray-900">{po.notes}</p>
                </div>
              )}
              {po.internalNotes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Internal Notes</h3>
                  <p className="text-gray-900">{po.internalNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Order Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Order Date</dt>
                <dd className="font-medium text-gray-900">
                  {format(new Date(po.orderDate), 'dd MMM yyyy')}
                </dd>
              </div>
              {po.requestedDeliveryDate && (
                <div>
                  <dt className="text-sm text-gray-500">Requested Delivery</dt>
                  <dd className="font-medium text-gray-900">
                    {format(new Date(po.requestedDeliveryDate), 'dd MMM yyyy')}
                  </dd>
                </div>
              )}
              {po.customerReference && (
                <div>
                  <dt className="text-sm text-gray-500">Customer Reference</dt>
                  <dd className="font-medium text-gray-900">{po.customerReference}</dd>
                </div>
              )}
              {po.internalReference && (
                <div>
                  <dt className="text-sm text-gray-500">Internal Reference</dt>
                  <dd className="font-medium text-gray-900">{po.internalReference}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Customer Info */}
          {po.customer && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Customer</h2>
              <dl className="space-y-2">
                <dd className="font-medium text-gray-900">{po.customer.name}</dd>
                {po.customer.companyName && (
                  <dd className="text-gray-600">{po.customer.companyName}</dd>
                )}
                {po.customer.email && (
                  <dd className="text-gray-500 text-sm">{po.customer.email}</dd>
                )}
                {po.customer.phone && (
                  <dd className="text-gray-500 text-sm">{po.customer.phone}</dd>
                )}
              </dl>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-2">
              {po.status === 'draft' && (
                <button
                  onClick={() => handleStatusChange('open')}
                  disabled={updating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  {updating ? 'Updating...' : 'Open PO'}
                </button>
              )}
              {canCancelPO(po.status) && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={updating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  <XMarkIcon className="w-4 h-4" />
                  {updating ? 'Updating...' : 'Cancel PO'}
                </button>
              )}
              {po.status === 'fully_invoiced' && (
                <button
                  onClick={() => handleStatusChange('closed')}
                  disabled={updating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Close PO'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
