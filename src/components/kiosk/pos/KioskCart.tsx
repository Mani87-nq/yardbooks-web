'use client';

import { useState, useMemo, useCallback } from 'react';
import { useKioskPosStore, type KioskPosSession } from '@/store/kioskPosStore';
import { calculateLineItem } from '@/lib/pos/cart-engine';

interface KioskCartProps {
  session: KioskPosSession;
  onStartPayment: () => void;
}

export default function KioskCart({ session, onStartPayment }: KioskCartProps) {
  const {
    currentCart,
    updateCartItemQty,
    removeFromCart,
    clearCart,
    getCartTotals,
  } = useKioskPosStore();

  const [holdError, setHoldError] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  const totals = useMemo(() => getCartTotals(), [currentCart, getCartTotals]);
  const gctRate = useKioskPosStore((s) => s.posSettings?.gctRate ?? 0.15);
  const items = currentCart.items;

  const formatCurrency = (amount: number) =>
    `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePay = useCallback(() => {
    if (items.length === 0) return;
    onStartPayment();
  }, [items.length, onStartPayment]);

  const handleHold = useCallback(async () => {
    if (items.length === 0) return;
    setIsHolding(true);
    setHoldError(null);

    try {
      // Create a draft order first, then hold it
      const orderRes = await fetch('/api/employee/pos/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          terminalId: session.terminalId,
          customerName: currentCart.customerName || 'Walk-in Customer',
          items: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            uomCode: item.uomCode || 'EA',
            unitPrice: item.unitPrice,
            isGctExempt: item.isGctExempt,
            discountType: item.discountType === 'percent' ? 'PERCENTAGE' : item.discountType === 'amount' ? 'FIXED' : undefined,
            discountValue: item.discountValue,
            notes: item.notes,
          })),
          orderDiscountType: currentCart.orderDiscountType === 'percent' ? 'PERCENTAGE' : currentCart.orderDiscountType === 'amount' ? 'FIXED' : undefined,
          orderDiscountValue: currentCart.orderDiscountValue,
          orderDiscountReason: currentCart.orderDiscountReason,
        }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json().catch(() => null);
        throw new Error(data?.detail ?? 'Failed to create order');
      }

      const order = await orderRes.json();

      // Now hold it
      const holdRes = await fetch(`/api/employee/pos/orders/${order.id}/hold`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heldReason: 'Customer requested hold' }),
      });

      if (holdRes.ok) {
        clearCart();
      } else {
        const data = await holdRes.json().catch(() => null);
        throw new Error(data?.detail ?? 'Failed to hold order');
      }
    } catch (err) {
      setHoldError(err instanceof Error ? err.message : 'Hold failed');
    } finally {
      setIsHolding(false);
    }
  }, [items, session, currentCart, clearCart]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Customer Header ──────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {currentCart.customerName || 'Walk-in Customer'}
          </span>
        </div>
      </div>

      {/* ── Cart Items ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
            <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Tap a product to add it
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {items.map((item) => (
              <div
                key={item.tempId}
                className="px-3 py-2 flex items-center gap-2 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {formatCurrency(item.unitPrice)} ea
                  </p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateCartItemQty(item.tempId, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 touch-manipulation text-sm font-bold"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-mono font-bold text-gray-900 dark:text-white">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartItemQty(item.tempId, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 touch-manipulation text-sm font-bold"
                  >
                    +
                  </button>
                </div>

                {/* Line Total */}
                <span className="w-20 text-right text-sm font-mono font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(calculateLineItem(item, gctRate).lineTotalBeforeTax)}
                </span>

                {/* Remove */}
                <button
                  onClick={() => removeFromCart(item.tempId)}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 touch-manipulation transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Totals + Actions ─────────────────────────────────────── */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
        {/* Totals */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Discount</span>
              <span className="font-mono">-{formatCurrency(totals.discountAmount)}</span>
            </div>
          )}
          {totals.gctAmount > 0 && (
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>GCT ({Math.round(gctRate * 100)}%)</span>
              <span className="font-mono">{formatCurrency(totals.gctAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-gray-700">
            <span>Total</span>
            <span className="font-mono">{formatCurrency(totals.total)}</span>
          </div>
        </div>

        {/* Hold Error */}
        {holdError && (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs text-center">
            {holdError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {items.length > 0 && (
            <button
              onClick={() => clearCart()}
              className="px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-xl touch-manipulation hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={handleHold}
              disabled={isHolding}
              className="px-3 py-2.5 text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20 rounded-xl touch-manipulation hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isHolding ? 'Holding...' : 'Hold'}
            </button>
          )}
          <button
            onClick={handlePay}
            disabled={items.length === 0}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold rounded-xl touch-manipulation transition-colors disabled:cursor-not-allowed text-center"
          >
            {items.length === 0
              ? 'Add Items'
              : `Pay ${formatCurrency(totals.total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
