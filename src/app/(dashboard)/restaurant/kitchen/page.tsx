'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FireIcon,
  ArrowPathIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  ArrowRightIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────────
interface KitchenOrderItem {
  id: string;
  name: string;
  quantity: number;
  modifiers: string | null;
  notes: string | null;
}

interface KitchenOrder {
  id: string;
  tableNumber: number | null;
  tableName: string | null;
  orderNumber: string | null;
  status: 'NEW' | 'IN_PROGRESS' | 'READY';
  items: KitchenOrderItem[];
  specialInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Time Helpers ─────────────────────────────────────────────────────
function getTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function getUrgencyColor(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 10) return 'text-emerald-600 dark:text-emerald-400';
  if (minutes < 20) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

// ── Column Config ────────────────────────────────────────────────────
const COLUMNS = [
  {
    key: 'NEW' as const,
    label: 'New Orders',
    headerBg: 'bg-blue-600',
    cardBorder: 'border-l-4 border-l-blue-500',
    emptyIcon: BellAlertIcon,
    emptyText: 'No new orders',
  },
  {
    key: 'IN_PROGRESS' as const,
    label: 'In Progress',
    headerBg: 'bg-orange-500',
    cardBorder: 'border-l-4 border-l-orange-500',
    emptyIcon: FireIcon,
    emptyText: 'Nothing cooking',
  },
  {
    key: 'READY' as const,
    label: 'Ready',
    headerBg: 'bg-emerald-600',
    cardBorder: 'border-l-4 border-l-emerald-500',
    emptyIcon: CheckIcon,
    emptyText: 'No orders ready',
  },
];

// ── Order Card ───────────────────────────────────────────────────────
function OrderCard({
  order,
  onAdvance,
  advancing,
}: {
  order: KitchenOrder;
  onAdvance: () => void;
  advancing: boolean;
}) {
  const timeSince = getTimeSince(order.createdAt);
  const urgencyColor = getUrgencyColor(order.createdAt);

  const nextStatusLabel: Record<string, string> = {
    NEW: 'Start',
    IN_PROGRESS: 'Ready',
    READY: 'Done',
  };

  const nextStatusIcon: Record<string, React.ReactNode> = {
    NEW: <ArrowRightIcon className="w-4 h-4" />,
    IN_PROGRESS: <CheckIcon className="w-4 h-4" />,
    READY: <CheckIcon className="w-4 h-4" />,
  };

  const nextStatusColor: Record<string, string> = {
    NEW: 'bg-orange-500 hover:bg-orange-600 text-white',
    IN_PROGRESS: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    READY: 'bg-gray-600 hover:bg-gray-700 text-white',
  };

  const column = COLUMNS.find((c) => c.key === order.status);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm ${column?.cardBorder || ''}`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {order.tableNumber != null && (
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              T{order.tableNumber}
            </span>
          )}
          {order.orderNumber && (
            <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              #{order.orderNumber}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1 text-sm font-bold ${urgencyColor}`}>
          <ClockIcon className="w-4 h-4" />
          {timeSince}
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="text-base font-bold text-gray-900 dark:text-white min-w-[1.5rem]">
              {item.quantity}x
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                {item.name}
              </p>
              {item.modifiers && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                  {item.modifiers}
                </p>
              )}
              {item.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5">
                  {item.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Special instructions */}
      {order.specialInstructions && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <p className="text-xs font-bold text-yellow-800 dark:text-yellow-300 uppercase mb-0.5">
            Special Instructions
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            {order.specialInstructions}
          </p>
        </div>
      )}

      {/* Action */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={onAdvance}
          disabled={advancing}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 ${nextStatusColor[order.status]}`}
        >
          {advancing ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            nextStatusIcon[order.status]
          )}
          {nextStatusLabel[order.status]}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [, setTick] = useState(0);

  const fetchOrders = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/modules/restaurant/kitchen');
      if (!res.ok) throw new Error('Failed to fetch kitchen orders');
      const json = await res.json();
      setOrders(json.data || json || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kitchen orders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOrders(true);
  }, [fetchOrders]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchOrders(false);
      }, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchOrders]);

  // Tick every second to update timers
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAdvance = async (order: KitchenOrder) => {
    const nextStatus: Record<string, string> = {
      NEW: 'IN_PROGRESS',
      IN_PROGRESS: 'READY',
      READY: 'COMPLETED',
    };

    const newStatus = nextStatus[order.status];
    if (!newStatus) return;

    setAdvancingId(order.id);
    try {
      const res = await fetch('/api/modules/restaurant/kitchen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update order');
      }

      // Optimistically update or refetch
      if (newStatus === 'COMPLETED') {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
      } else {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, status: newStatus as KitchenOrder['status'], updatedAt: new Date().toISOString() } : o
          )
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setAdvancingId(null);
    }
  };

  // Group orders by status
  const ordersByStatus = {
    NEW: orders.filter((o) => o.status === 'NEW'),
    IN_PROGRESS: orders.filter((o) => o.status === 'IN_PROGRESS'),
    READY: orders.filter((o) => o.status === 'READY'),
  };

  // Loading
  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-8 text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300">Kitchen display error</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button
            onClick={() => fetchOrders(true)}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/60"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header - bold, high contrast for kitchen */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600 rounded-xl">
            <FireIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              KITCHEN DISPLAY
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Last updated {lastRefresh.toLocaleTimeString()} {autoRefresh && '(auto-refresh 30s)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              autoRefresh
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            Auto
          </button>
          <button
            onClick={() => fetchOrders(false)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 text-center">
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{ordersByStatus.NEW.length}</p>
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">New</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-2 text-center">
          <p className="text-2xl font-black text-orange-700 dark:text-orange-300">{ordersByStatus.IN_PROGRESS.length}</p>
          <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase">In Progress</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-2 text-center">
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{ordersByStatus.READY.length}</p>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Ready</p>
        </div>
      </div>

      {/* Empty state */}
      {orders.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FireIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Kitchen is clear</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No active orders. New orders from the POS will appear here automatically.
          </p>
        </div>
      )}

      {/* KDS Columns */}
      {orders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {COLUMNS.map((column) => {
            const columnOrders = ordersByStatus[column.key];
            return (
              <div key={column.key} className="flex flex-col min-h-0">
                {/* Column header */}
                <div className={`${column.headerBg} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                  <h2 className="text-base font-black text-white uppercase tracking-wide">
                    {column.label}
                  </h2>
                  <span className="bg-white/20 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                    {columnOrders.length}
                  </span>
                </div>

                {/* Column body */}
                <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl border border-t-0 border-gray-200 dark:border-gray-700 p-3 space-y-3 min-h-[200px]">
                  {columnOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                      <column.emptyIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-sm text-gray-400 dark:text-gray-500">{column.emptyText}</p>
                    </div>
                  ) : (
                    columnOrders
                      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                      .map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          onAdvance={() => handleAdvance(order)}
                          advancing={advancingId === order.id}
                        />
                      ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
