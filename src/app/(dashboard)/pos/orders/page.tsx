'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, StatusBadge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import {
  usePosOrders,
  apiStatusToFrontend,
  frontendStatusToApi,
  type ApiPosOrder,
} from '@/hooks/api/usePos';
import { useAppStore } from '@/store/appStore';
import { formatJMD, formatDateTime } from '@/lib/utils';
import { printContent, generateTable, formatPrintCurrency } from '@/lib/print';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PrinterIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export default function POSOrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch orders from API. We request a large batch and filter client-side for search,
  // since the API supports status filtering but not text search.
  const apiStatus = statusFilter !== 'all' ? frontendStatusToApi(statusFilter) : undefined;
  const { data: ordersData, isLoading, error, refetch } = usePosOrders({
    status: apiStatus,
    limit: 100,
  });

  const orders = ordersData?.data ?? [];
  const activeCompany = useAppStore((state) => state.activeCompany);

  const handlePrintOrder = (order: ApiPosOrder) => {
    const content = `
      <table style="width:100%;margin-bottom:20px;border-collapse:collapse;">
        <tr><td style="padding:8px;color:#6b7280;">Order Number</td><td style="padding:8px;font-weight:500;">${order.orderNumber}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Date</td><td style="padding:8px;font-weight:500;">${formatDateTime(order.createdAt)}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Customer</td><td style="padding:8px;font-weight:500;">${order.customerName}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Status</td><td style="padding:8px;font-weight:500;text-transform:capitalize;">${apiStatusToFrontend(order.status).replace('_', ' ')}</td></tr>
      </table>
      ${generateTable(
        [
          { key: 'name', label: 'Item' },
          { key: 'quantity', label: 'Qty', align: 'right' },
          { key: 'price', label: 'Price', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
        ],
        order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: Number(item.unitPrice),
          total: Number(item.lineSubtotal),
        })),
        {
          formatters: {
            price: formatPrintCurrency,
            total: formatPrintCurrency,
          },
          summaryRow: {
            name: 'Total',
            quantity: order.itemCount,
            price: '',
            total: Number(order.total),
          },
        }
      )}
    `;

    printContent({
      title: 'POS Receipt',
      subtitle: `${order.orderNumber} - ${formatDateTime(order.createdAt)}`,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  // Client-side search filtering (API handles status filtering)
  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    return orders.filter((order: ApiPosOrder) => {
      return (
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [orders, searchQuery]);

  const statuses = ['all', 'completed', 'pending_payment', 'held', 'voided', 'refunded'];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pos">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to POS
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
              <p className="text-gray-500">View all POS transactions</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pos">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to POS
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
              <p className="text-gray-500">View all POS transactions</p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-gray-700 font-medium mb-2">Failed to load orders</p>
              <p className="text-gray-500 text-sm mb-4">
                {error instanceof Error ? error.message : 'Please try again.'}
              </p>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
            <p className="text-gray-500">View all POS transactions</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search orders..."
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
              {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order: ApiPosOrder) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell className="text-gray-500">{formatDateTime(order.createdAt)}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.itemCount} items</TableCell>
                  <TableCell className="font-medium">{formatJMD(Number(order.total))}</TableCell>
                  <TableCell>
                    <StatusBadge status={apiStatusToFrontend(order.status)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/pos/orders/${order.id}`}>
                        <Button variant="ghost" size="sm">
                          <EyeIcon className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrintOrder(order)}
                        title="Print receipt"
                      >
                        <PrinterIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
