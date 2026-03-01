'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useKioskPosStore, type KioskPosSession } from '@/store/kioskPosStore';

interface PaymentScreenProps {
  session: KioskPosSession;
  onComplete: () => void;
  onCancel: () => void;
}

// Payment method config
const PAYMENT_METHOD_CONFIG: Record<string, { label: string; icon: string }> = {
  CASH: { label: 'Cash', icon: '💵' },
  JAM_DEX: { label: 'JAM-DEX', icon: '🇯🇲' },
  CARD_VISA: { label: 'Visa', icon: '💳' },
  CARD_MASTERCARD: { label: 'Mastercard', icon: '💳' },
  CARD_OTHER: { label: 'Card', icon: '💳' },
  LYNK_WALLET: { label: 'Lynk', icon: '📱' },
  WIPAY: { label: 'WiPay', icon: '🌐' },
  BANK_TRANSFER: { label: 'Transfer', icon: '🏦' },
  STORE_CREDIT: { label: 'Store Credit', icon: '🎫' },
  OTHER: { label: 'Other', icon: '📋' },
};

const QUICK_CASH = [100, 500, 1000, 2000, 5000, 10000];

type Step = 'method' | 'cash-entry' | 'processing' | 'complete';

export default function PaymentScreen({
  session,
  onComplete,
  onCancel,
}: PaymentScreenProps) {
  const {
    currentCart,
    posSettings,
    getCartTotals,
    clearCart,
    pendingOrderId,
    resumedOrderId,
    setPendingOrderId,
    setResumedOrderId,
    setPaymentStep,
    setLastCompletedOrder,
  } = useKioskPosStore();

  const [step, setStep] = useState<Step>('method');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [cashEntered, setCashEntered] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string;
    total: number;
    changeGiven: number;
    paymentMethod: string;
  } | null>(null);

  const totals = useMemo(() => getCartTotals(), [currentCart, getCartTotals]);

  const enabledMethods = useMemo(() => {
    const methods = (posSettings?.enabledPaymentMethods as string[]) ?? ['CASH'];
    return methods;
  }, [posSettings]);

  const formatCurrency = (amount: number) =>
    `J$${amount.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Process Payment (defined first, referenced by handlers below) ──

  const processPayment = useCallback(
    async (method: string, amount: number, amountTendered: number) => {
      setStep('processing');
      setError(null);

      try {
        let orderId = pendingOrderId || resumedOrderId;

        // Step 1: Create order if we don't have one
        if (!orderId) {
          const orderRes = await fetch('/api/employee/pos/orders', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: session.id,
              terminalId: session.terminalId,
              customerName: currentCart.customerName || 'Walk-in Customer',
              customerId: currentCart.customerId,
              items: currentCart.items.map((item) => ({
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
          orderId = order.id;
          setPendingOrderId(order.id);
        }

        // Step 2: Add payment
        const paymentRes = await fetch(`/api/employee/pos/orders/${orderId}/payments`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method,
            amount,
            amountTendered: method === 'CASH' ? amountTendered : undefined,
            status: 'COMPLETED',
          }),
        });

        if (!paymentRes.ok) {
          const data = await paymentRes.json().catch(() => null);
          throw new Error(data?.detail ?? 'Payment failed');
        }

        const paymentResult = await paymentRes.json();
        const order = paymentResult.order;
        const payment = paymentResult.payment;

        const changeGiven = payment.changeGiven ? Number(payment.changeGiven) : 0;

        setCompletedOrder({
          orderNumber: order.orderNumber,
          total: Number(order.total),
          changeGiven,
          paymentMethod: PAYMENT_METHOD_CONFIG[method]?.label ?? method,
        });

        setLastCompletedOrder({
          id: order.id,
          orderNumber: order.orderNumber,
          total: Number(order.total),
          changeGiven,
          paymentMethod: method,
          customerName: order.customerName,
        });

        setStep('complete');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Payment failed');
        setStep(selectedMethod === 'CASH' ? 'cash-entry' : 'method');
      }
    },
    [session, currentCart, pendingOrderId, resumedOrderId, setPendingOrderId, setLastCompletedOrder, selectedMethod]
  );

  // ── New Sale handler (stable ref for timer) ──────────────────
  const handleNewSale = useCallback(() => {
    clearCart();
    setPaymentStep('idle');
    onComplete();
  }, [clearCart, onComplete, setPaymentStep]);

  const handleNewSaleRef = useRef(handleNewSale);
  handleNewSaleRef.current = handleNewSale;

  // ── Auto-return after completion ──────────────────────────────
  useEffect(() => {
    if (step === 'complete') {
      const timer = setTimeout(() => {
        handleNewSaleRef.current();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // ── Method Selection ──────────────────────────────────────────
  const handleMethodSelect = useCallback((method: string) => {
    setSelectedMethod(method);
    if (method === 'CASH') {
      setStep('cash-entry');
    } else {
      processPayment(method, totals.total, totals.total);
    }
  }, [totals.total, processPayment]);

  // ── Cash Entry ────────────────────────────────────────────────
  const cashAmount = useMemo(() => {
    const val = parseFloat(cashEntered);
    return isNaN(val) ? 0 : val;
  }, [cashEntered]);

  const changeAmount = useMemo(() => {
    return Math.max(0, cashAmount - totals.total);
  }, [cashAmount, totals.total]);

  const handleQuickCash = useCallback((amount: number) => {
    setCashEntered(amount.toString());
  }, []);

  const handleExactCash = useCallback(() => {
    setCashEntered(totals.total.toFixed(2));
  }, [totals.total]);

  const handleNumpadPress = useCallback((key: string) => {
    setCashEntered((prev) => {
      if (key === 'C') return '';
      if (key === '⌫') return prev.slice(0, -1);
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return (prev || '0') + '.';
      }
      // Limit to 2 decimal places
      const dotIndex = prev.indexOf('.');
      if (dotIndex !== -1 && prev.length - dotIndex > 2) return prev;
      return prev + key;
    });
  }, []);

  const handleCashSubmit = useCallback(() => {
    if (cashAmount < totals.total) {
      setError('Amount tendered must be at least the total.');
      return;
    }
    processPayment('CASH', totals.total, cashAmount);
  }, [cashAmount, totals.total, processPayment]);

  // ── Render: Method Selection ──────────────────────────────────
  if (step === 'method') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          {/* Total */}
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Amount Due</p>
            <p className="text-4xl font-mono font-bold text-gray-900 dark:text-white">
              {formatCurrency(totals.total)}
            </p>
          </div>

          {/* Methods Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {enabledMethods.map((method) => {
              const config = PAYMENT_METHOD_CONFIG[method];
              if (!config) return null;
              return (
                <button
                  key={method}
                  onClick={() => handleMethodSelect(method)}
                  className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 active:scale-95 touch-manipulation transition-all min-h-[80px]"
                >
                  <span className="text-2xl mb-1">{config.icon}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {config.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-full py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 touch-manipulation transition-colors"
          >
            Back to Cart
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Cash Entry ────────────────────────────────────────
  if (step === 'cash-entry') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Amount Due</p>
            <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
              {formatCurrency(totals.total)}
            </p>
          </div>

          {/* Cash Entered Display */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cash Tendered</p>
            <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
              {cashEntered ? `J$${cashEntered}` : 'J$0.00'}
            </p>
            {cashAmount >= totals.total && (
              <p className="text-lg font-mono font-bold text-green-600 dark:text-green-400 mt-1">
                Change: {formatCurrency(changeAmount)}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Quick Cash Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              onClick={handleExactCash}
              className="py-2.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm font-semibold touch-manipulation hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
            >
              Exact
            </button>
            {QUICK_CASH.map((amount) => (
              <button
                key={amount}
                onClick={() => handleQuickCash(amount)}
                className="py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-mono font-semibold touch-manipulation hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                J${amount.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
              <button
                key={key}
                onClick={() => handleNumpadPress(key)}
                className="py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xl font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 touch-manipulation transition-colors"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep('method');
                setSelectedMethod(null);
                setCashEntered('');
                setError(null);
              }}
              className="px-6 py-3 text-gray-600 dark:text-gray-400 font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 touch-manipulation transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCashSubmit}
              disabled={cashAmount < totals.total}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold rounded-xl touch-manipulation transition-colors disabled:cursor-not-allowed"
            >
              Complete Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Processing ────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            Processing Payment...
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please wait</p>
        </div>
      </div>
    );
  }

  // ── Render: Complete ──────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md text-center">
        {/* Success Check */}
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Payment Complete!
        </h2>

        {completedOrder && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Order #{completedOrder.orderNumber}
            </p>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {formatCurrency(completedOrder.total)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Method</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {completedOrder.paymentMethod}
                  </span>
                </div>
                {completedOrder.changeGiven > 0 && (
                  <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">Change</span>
                    <span className="text-lg font-mono font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(completedOrder.changeGiven)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <button
          onClick={handleNewSale}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg rounded-xl touch-manipulation transition-colors mb-3"
        >
          New Sale
        </button>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Auto-returning to register in 15 seconds...
        </p>
      </div>
    </div>
  );
}
