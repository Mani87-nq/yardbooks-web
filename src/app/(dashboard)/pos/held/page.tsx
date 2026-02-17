'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, StatusBadge } from '@/components/ui';
import { usePosStore } from '@/store/posStore';
import { formatJMD, formatDateTime } from '@/lib/utils';
import {
  ArrowLeftIcon,
  PlayIcon,
  TrashIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export default function POSHeldOrdersPage() {
  const { getHeldOrders, resumeHeldOrder, voidOrder } = usePosStore();
  const heldOrders = getHeldOrders();

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
          {heldOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                  <StatusBadge status={order.status} />
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
                    <span className="font-bold text-emerald-600">{formatJMD(order.total)}</span>
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
                    onClick={() => voidOrder(order.id, 'Cancelled from held orders')}
                  >
                    <TrashIcon className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                  <Link href="/pos" className="flex-1">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => resumeHeldOrder(order.id)}
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
