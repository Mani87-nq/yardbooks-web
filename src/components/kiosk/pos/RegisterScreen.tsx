'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useKioskPosStore, type KioskPosSession } from '@/store/kioskPosStore';
import KioskProductGrid from './KioskProductGrid';
import KioskCart from './KioskCart';
import PaymentScreen from './PaymentScreen';
import HeldOrdersPanel from './HeldOrdersPanel';

interface RegisterScreenProps {
  session: KioskPosSession;
  onRequestCloseSession: () => void;
}

export default function RegisterScreen({
  session,
  onRequestCloseSession,
}: RegisterScreenProps) {
  const {
    currentCart,
    paymentStep,
    setPaymentStep,
    setProducts,
    setCategories,
    products,
    productsLoadedAt,
    posSettings,
    getCartTotals,
  } = useKioskPosStore();

  const [showHeldOrders, setShowHeldOrders] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // ── Load products on mount ────────────────────────────────────
  const loadProducts = useCallback(async () => {
    // Don't reload if loaded within the last 5 minutes
    if (productsLoadedAt && Date.now() - productsLoadedAt < 5 * 60 * 1000 && products.length > 0) {
      return;
    }

    setIsLoadingProducts(true);
    try {
      const res = await fetch('/api/employee/pos/products?limit=500', { credentials: 'include' });
      if (res.ok) {
        const { data, categories } = await res.json();
        setProducts(data);
        setCategories(categories);
      }
    } catch (err) {
      console.error('[Kiosk POS] Failed to load products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [productsLoadedAt, products.length, setProducts, setCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ── Cart totals ───────────────────────────────────────────────
  const totals = useMemo(() => getCartTotals(), [currentCart, getCartTotals]);
  const cartItemCount = currentCart.items.length;

  // ── Payment flow ──────────────────────────────────────────────
  if (paymentStep !== 'idle') {
    return (
      <PaymentScreen
        session={session}
        onComplete={() => {
          setPaymentStep('idle');
        }}
        onCancel={() => {
          setPaymentStep('idle');
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {session.terminalName}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Session: {session.cashierName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHeldOrders(true)}
            className="px-3 py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-lg touch-manipulation hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
          >
            Held Orders
          </button>
          <button
            onClick={onRequestCloseSession}
            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg touch-manipulation hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Close Session
          </button>
        </div>
      </div>

      {/* ── Main Content: Split Panel ───────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product Grid */}
        <div className="flex-1 overflow-y-auto">
          <KioskProductGrid isLoading={isLoadingProducts} onRefresh={loadProducts} />
        </div>

        {/* Right: Cart Panel (hidden on mobile, shown on tablet+) */}
        <div className="hidden md:flex md:w-80 lg:w-96 flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <KioskCart
            session={session}
            onStartPayment={() => setPaymentStep('method')}
          />
        </div>
      </div>

      {/* ── Mobile Cart Floating Button ─────────────────────────── */}
      {cartItemCount > 0 && (
        <div className="md:hidden fixed bottom-20 left-4 right-4 z-30">
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg touch-manipulation transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-sm font-bold">
                {cartItemCount}
              </span>
              <span className="font-medium">View Cart</span>
            </div>
            <span className="font-mono font-bold">
              J${totals.total.toLocaleString('en-JM', { minimumFractionDigits: 2 })}
            </span>
          </button>
        </div>
      )}

      {/* ── Mobile Cart Bottom Sheet ────────────────────────────── */}
      {showMobileCart && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileCart(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cart</h3>
              <button
                onClick={() => setShowMobileCart(false)}
                className="p-2 text-gray-400 hover:text-gray-600 touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <KioskCart
                session={session}
                onStartPayment={() => {
                  setShowMobileCart(false);
                  setPaymentStep('method');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Held Orders Slide-in ────────────────────────────────── */}
      {showHeldOrders && (
        <HeldOrdersPanel
          session={session}
          onClose={() => setShowHeldOrders(false)}
        />
      )}
    </div>
  );
}
