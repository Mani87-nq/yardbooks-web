'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, StatusBadge } from '@/components/ui';
import {
  usePosOrders,
  useVoidPosOrder,
  apiStatusToFrontend,
  type ApiPosOrder,
} from '@/hooks/api/usePos';
import { formatDateTime } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import {
  ArrowLeftIcon,
  PlayIcon,
  TrashIcon,
  ClockIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export default function POSHeldOrdersPage() {
  const { fc } = useCurrency();
  const { data: heldOrdersData, isLoading, error, refetch } = usePosOrders({ status: 'HELD', limit: 50 });
  const voidOrderMutation = useVoidPosOrder();
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const heldOrders = heldOrdersData?.data ?? [];

  const handleVoidOrder = async (orderId: string) => {
    setVoidingId(orderId);
    try {
      await voidOrderMutation.mutateAsync({
        id: orderId,
        voidReason: 'Cancelled from held orders',
      });
    } catch (err) {
      console.error('Failed to void order:', err);
    } finally {
      setVoidingId(null);
    }
  };

  // Resume: navigate to POS with order data loaded as cart via query param
  // For now, we navigate to POS. The main POS page would need to handle
  // loading a held order's items into the cart. We keep this as a simple link
  // and the user can manually re-add items. A full resume would require more
  // infrastructure (e.g., storing the resuming order ID in a URL param or context).

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Held Orders</h1>
            <p className="text-gray-500">Resume or clear parked orders</p>
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
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Held Orders</h1>
            <p className="text-gray-500">Resume or clear parked orders</p>
          </div>
        </div>
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-gray-700 font-medium mb-2">Failed to load held orders</p>
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
      <div className="flex items-center gap-4">
        <Link href="/pos">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to POS
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Held Orders</h1>
          <p className="text-gray-500">Resume or clear parked orders</p>
        </div>
      </div>

      {/* Mutation error */}
      {voidOrderMutation.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            {voidOrderMutation.error instanceof Error
              ? voidOrderMutation.error.message
              : 'Failed to void order. Please try again.'}
          </p>
        </div>
      )}

      {/* Held Orders List */}
      {heldOrders.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ClockIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">No held orders</p>
              <Link href="/pos">
                <Button>Back to POS</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {heldOrders.map((order: ApiPosOrder) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                  <StatusBadge status={apiStatusToFrontend(order.status)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Customer</span>
                    <span className="font-medium">{order.customerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Items</span>
                    <span className="font-medium">{order.itemCount} items</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold text-emerald-600">{fc(Number(order.total))}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Held: {formatDateTime(order.updatedAt)}
                  </div>
                  {order.heldReason && (
                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      {order.heldReason}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleVoidOrder(order.id)}
                    disabled={voidingId === order.id}
                  >
                    {voidingId === order.id ? (
                      <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <TrashIcon className="w-4 h-4 mr-1" />
                    )}
                    Clear
                  </Button>
                  <Link href={`/pos?resume=${order.id}`} className="flex-1">
                    <Button
                      size="sm"
                      className="w-full"
                    >
                      <PlayIcon className="w-4 h-4 mr-1" />
                      Resume
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
