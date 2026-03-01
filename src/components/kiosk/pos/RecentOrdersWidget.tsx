'use client';

import { useState, useEffect } from 'react';

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  HELD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  VOIDED: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  REFUNDED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
};

export default function RecentOrdersWidget() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/employee/pos/orders?limit=5', {
          credentials: 'include',
        });
        if (res.ok) {
          const { data } = await res.json();
          setOrders(
            data.map((o: any) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              customerName: o.customerName,
              total: Number(o.total),
              status: o.status,
              createdAt: o.createdAt,
            }))
          );
        }
      } catch (err) {
        console.error('[Kiosk] Failed to fetch recent orders:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const formatCurrency = (amount: number) =>
    `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-JM', { hour: '2-digit', minute: '2-digit' });
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Recent Orders
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          No recent orders
        </p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {order.orderNumber}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {formatStatus(order.status)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {order.customerName} · {formatTime(order.createdAt)}
                </p>
              </div>
              <span className="font-mono font-semibold text-sm text-gray-900 dark:text-white">
                {formatCurrency(order.total)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
