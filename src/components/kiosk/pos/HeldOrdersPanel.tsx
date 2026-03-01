'use client';

import { useState, useEffect, useCallback } from 'react';
import { useKioskPosStore, type KioskPosSession, type HeldOrderSummary } from '@/store/kioskPosStore';

interface HeldOrdersPanelProps {
  session: KioskPosSession;
  onClose: () => void;
}

export default function HeldOrdersPanel({ session, onClose }: HeldOrdersPanelProps) {
  const {
    heldOrders,
    setHeldOrders,
    loadFromHeldOrder,
    currentCart,
  } = useKioskPosStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingVoid, setConfirmingVoid] = useState<string | null>(null);
  const [confirmingResume, setConfirmingResume] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Fetch held orders ─────────────────────────────────────────
  const fetchHeldOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/employee/pos/orders?status=HELD&terminalId=${session.terminalId}&limit=50`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const { data } = await res.json();
        const mapped: HeldOrderSummary[] = data.map((order: any) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: Number(order.total),
          itemCount: order.itemCount ?? order.items?.length ?? 0,
          heldReason: order.heldReason,
          createdAt: order.createdAt,
          items: order.items?.map((item: any) => ({
            productId: item.productId,
            name: item.name,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discountType: item.discountType === 'PERCENTAGE' ? 'percent' as const : item.discountType === 'FIXED' ? 'amount' as const : undefined,
            discountValue: item.discountValue ? Number(item.discountValue) : undefined,
            isGctExempt: item.isGctExempt ?? false,
            uomCode: item.uomCode,
            notes: item.notes,
          })),
        }));
        setHeldOrders(mapped);
      }
    } catch (err) {
      setError('Failed to load held orders');
    } finally {
      setIsLoading(false);
    }
  }, [session.terminalId, setHeldOrders]);

  useEffect(() => {
    fetchHeldOrders();
  }, [fetchHeldOrders]);

  // ── Resume held order ─────────────────────────────────────────
  const handleResume = useCallback(
    (order: HeldOrderSummary) => {
      // If cart has items, confirm before replacing
      if (currentCart.items.length > 0) {
        setConfirmingResume(order.id);
        return;
      }
      loadFromHeldOrder(order);
      onClose();
    },
    [loadFromHeldOrder, onClose, currentCart.items.length]
  );

  const confirmResume = useCallback(
    (order: HeldOrderSummary) => {
      setConfirmingResume(null);
      loadFromHeldOrder(order);
      onClose();
    },
    [loadFromHeldOrder, onClose]
  );

  // ── Void held order ───────────────────────────────────────────
  const handleVoid = useCallback(
    (orderId: string) => {
      setConfirmingVoid(orderId);
    },
    []
  );

  const confirmVoid = useCallback(
    async (orderId: string) => {
      setConfirmingVoid(null);
      try {
        const res = await fetch(`/api/employee/pos/orders/${orderId}/void`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voidReason: 'Held order cancelled' }),
        });
        if (res.ok) {
          setHeldOrders(heldOrders.filter((o) => o.id !== orderId));
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.detail ?? 'Failed to void order');
        }
      } catch (err) {
        setError('Failed to void order');
      }
    },
    [heldOrders, setHeldOrders]
  );

  const timeSince = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-800 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Held Orders
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-manipulation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl h-24 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-3">{error}</p>
              <button
                onClick={() => { setError(null); fetchHeldOrders(); }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
              >
                Retry
              </button>
            </div>
          ) : heldOrders.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No held orders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {heldOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {order.orderNumber}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {order.customerName} · {order.itemCount} items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                        {formatCurrency(order.total)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {timeSince(order.createdAt)}
                      </p>
                    </div>
                  </div>

                  {order.heldReason && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mb-2 italic">
                      {order.heldReason}
                    </p>
                  )}

                  {/* Confirmation dialogs */}
                  {confirmingResume === order.id ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-2">
                      <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-2">
                        Your current cart has items. Resuming will replace them.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmResume(order)}
                          className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg touch-manipulation"
                        >
                          Replace Cart
                        </button>
                        <button
                          onClick={() => setConfirmingResume(null)}
                          className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-xs border border-gray-300 dark:border-gray-600 rounded-lg touch-manipulation"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : confirmingVoid === order.id ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-2">
                      <p className="text-xs text-red-800 dark:text-red-300 mb-2">
                        Void this order? This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmVoid(order.id)}
                          className="flex-1 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg touch-manipulation"
                        >
                          Confirm Void
                        </button>
                        <button
                          onClick={() => setConfirmingVoid(null)}
                          className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-xs border border-gray-300 dark:border-gray-600 rounded-lg touch-manipulation"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResume(order)}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg touch-manipulation transition-colors"
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => handleVoid(order.id)}
                        className="px-4 py-2 text-red-600 dark:text-red-400 text-sm font-medium border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 touch-manipulation transition-colors"
                      >
                        Void
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
