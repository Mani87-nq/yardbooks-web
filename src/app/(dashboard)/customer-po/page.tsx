'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  DocumentTextIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/appStore';
import type { CustomerPurchaseOrder, CustomerPOStatus } from '@/types/customerPO';
import {
  CUSTOMER_PO_STATUS_LABELS,
  CUSTOMER_PO_STATUS_COLORS,
  calculatePOProgress,
} from '@/types/customerPO';

const FILTER_OPTIONS: { value: CustomerPOStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'partially_invoiced', label: 'Partial' },
  { value: 'fully_invoiced', label: 'Invoiced' },
  { value: 'closed', label: 'Closed' },
];

export default function CustomerPOPage() {
  const customerPOs = useAppStore((state) => state.customerPOs) || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CustomerPOStatus | 'all'>('all');

  const filteredPOs = useMemo(() => {
    let result = [...customerPOs];

    if (activeFilter !== 'cancelled') {
      result = result.filter((po) => po.status !== 'cancelled');
    }

    if (activeFilter !== 'all') {
      result = result.filter((po) => po.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((po) =>
        po.poNumber.toLowerCase().includes(query) ||
        po.internalReference?.toLowerCase().includes(query) ||
        po.customer?.name.toLowerCase().includes(query) ||
        po.customer?.companyName?.toLowerCase().includes(query)
      );
    }

    result.sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );

    return result;
  }, [customerPOs, activeFilter, searchQuery]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Purchase Orders</h1>
          <p className="text-gray-500 mt-1">Track and manage customer orders</p>
        </div>
        <Link
          href="/customer-po/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          New PO
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PO number, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === option.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* PO List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredPOs.length === 0 ? (
          <div className="p-12 text-center">
            <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No purchase orders found</h3>
            <p className="text-gray-500 mb-4">
              {activeFilter !== 'all'
                ? `No ${CUSTOMER_PO_STATUS_LABELS[activeFilter as CustomerPOStatus]} purchase orders`
                : 'Create your first customer PO to track orders'}
            </p>
            <Link
              href="/customer-po/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <PlusIcon className="w-5 h-5" />
              Create PO
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredPOs.map((po) => {
              const progress = calculatePOProgress(po.totalOrderedQuantity, po.totalInvoicedQuantity);
              return (
                <Link
                  key={po.id}
                  href={`/customer-po/${po.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5 text-emerald-600" />
                        <span className="font-semibold text-gray-900">{po.poNumber}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {po.customer?.name || 'Unknown Customer'}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                      {CUSTOMER_PO_STATUS_LABELS[po.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm border-y border-gray-100 py-3 mb-3">
                    <div>
                      <span className="text-gray-500 text-xs uppercase">Order Date</span>
                      <p className="font-medium text-gray-900">
                        {format(new Date(po.orderDate), 'dd MMM yyyy')}
                      </p>
                    </div>
                    {po.requestedDeliveryDate && (
                      <div>
                        <span className="text-gray-500 text-xs uppercase">Delivery</span>
                        <p className="font-medium text-gray-900">
                          {format(new Date(po.requestedDeliveryDate), 'dd MMM yyyy')}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500 text-xs uppercase">Items</span>
                      <p className="font-medium text-gray-900">{po.items.length}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-500">
                        Ordered: <span className="font-medium text-gray-900">{po.totalOrderedQuantity}</span>
                      </span>
                      <span className="text-gray-500">
                        Invoiced: <span className="font-medium text-green-600">{po.totalInvoicedQuantity}</span>
                      </span>
                      {po.totalRemainingQuantity > 0 && (
                        <span className="text-gray-500">
                          Remaining: <span className="font-medium text-orange-600">{po.totalRemainingQuantity}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-orange-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{progress}%</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
