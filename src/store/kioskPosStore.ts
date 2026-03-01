/**
 * Yaad Books Web - Kiosk POS Register Store
 *
 * Focused Zustand store for the kiosk point-of-sale register.
 * Manages cart state, session state, payment flow, and product cache.
 *
 * Uses the shared cart engine (src/lib/pos/cart-engine.ts) for all
 * financial calculations — identical math to the admin POS store.
 *
 * Persisted to sessionStorage so state survives page refreshes
 * but clears when the browser tab/window closes.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { calculateCartTotals, type CartTotals } from '@/lib/pos/cart-engine';
import type { CartItem, PosCart, PosSettings } from '@/types/pos';

// ── Types ────────────────────────────────────────────────────────

interface KioskPosSession {
  id: string;
  terminalId: string;
  terminalName: string;
  cashierName: string;
  openingCash: number;
  expectedCash: number;
  totalSales: number;
  totalRefunds: number;
  netSales: number;
  status: string;
  openedAt: string;
}

interface HeldOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  itemCount: number;
  heldReason?: string;
  createdAt: string;
  items?: Array<{
    productId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discountType?: 'percent' | 'amount';
    discountValue?: number;
    isGctExempt?: boolean;
    uomCode?: string;
    notes?: string;
  }>;
}

interface CompletedOrderInfo {
  id: string;
  orderNumber: string;
  total: number;
  changeGiven: number;
  paymentMethod: string;
  customerName: string;
}

interface CachedProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  unitPrice: number;
  quantity: number;
  isGctExempt: boolean;
  imageUrl?: string | null;
  categoryName?: string;
}

type PaymentStep = 'idle' | 'method' | 'amount' | 'processing' | 'complete';

// ── Store Interface ──────────────────────────────────────────────

interface KioskPosState {
  // Cart
  currentCart: PosCart;

  // Active POS session
  currentSession: KioskPosSession | null;

  // Held orders cache
  heldOrders: HeldOrderSummary[];

  // Payment flow
  pendingOrderId: string | null;
  resumedOrderId: string | null; // For resuming held orders
  paymentStep: PaymentStep;

  // Recently completed order (for receipt screen)
  lastCompletedOrder: CompletedOrderInfo | null;

  // Product catalog cache
  products: CachedProduct[];
  categories: string[];
  productsLoadedAt: number | null;

  // POS settings cache
  posSettings: PosSettings | null;

  // ── Cart Actions ────────────────────────────────────────────

  /** Add a product to the cart. If already present, increments quantity. */
  addToCart: (product: {
    productId?: string;
    name: string;
    unitPrice: number;
    sku?: string;
    barcode?: string;
    uomCode?: string;
    isGctExempt?: boolean;
    description?: string;
  }) => void;

  /** Update quantity for a cart item. */
  updateCartItemQty: (tempId: string, quantity: number) => void;

  /** Apply a line-item discount. */
  updateCartItemDiscount: (
    tempId: string,
    discountType: 'percent' | 'amount' | undefined,
    discountValue: number | undefined,
  ) => void;

  /** Remove an item from cart. */
  removeFromCart: (tempId: string) => void;

  /** Clear the entire cart. */
  clearCart: () => void;

  /** Set customer info on the cart. */
  setCartCustomer: (customerId: string | undefined, customerName: string) => void;

  /** Set order-level discount. */
  setCartDiscount: (
    type: 'percent' | 'amount' | undefined,
    value: number | undefined,
    reason?: string,
  ) => void;

  /** Calculate current cart totals using the shared cart engine. */
  getCartTotals: () => CartTotals;

  /** Populate cart from a held order (resume). */
  loadFromHeldOrder: (order: HeldOrderSummary) => void;

  // ── Session Actions ─────────────────────────────────────────

  setCurrentSession: (session: KioskPosSession | null) => void;

  // ── Order Actions ───────────────────────────────────────────

  setHeldOrders: (orders: HeldOrderSummary[]) => void;
  setPendingOrderId: (id: string | null) => void;
  setResumedOrderId: (id: string | null) => void;
  setPaymentStep: (step: PaymentStep) => void;
  setLastCompletedOrder: (order: CompletedOrderInfo | null) => void;

  // ── Product/Settings Cache ──────────────────────────────────

  setProducts: (products: CachedProduct[]) => void;
  setCategories: (categories: string[]) => void;
  setPosSettings: (settings: PosSettings) => void;

  // ── Reset ───────────────────────────────────────────────────

  /** Full reset (session close, sign out). */
  resetPosState: () => void;
}

// ── Defaults ─────────────────────────────────────────────────────

const EMPTY_CART: PosCart = {
  items: [],
  customerName: 'Walk-in',
};

// ── Store ────────────────────────────────────────────────────────

export const useKioskPosStore = create<KioskPosState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentCart: { ...EMPTY_CART },
      currentSession: null,
      heldOrders: [],
      pendingOrderId: null,
      resumedOrderId: null,
      paymentStep: 'idle',
      lastCompletedOrder: null,
      products: [],
      categories: [],
      productsLoadedAt: null,
      posSettings: null,

      // ── Cart Actions ──────────────────────────────────────────

      addToCart: (product) => {
        set((state) => {
          const existing = state.currentCart.items.find(
            (item) => item.productId === product.productId && product.productId,
          );

          if (existing) {
            // Increment quantity of existing item
            return {
              currentCart: {
                ...state.currentCart,
                items: state.currentCart.items.map((item) =>
                  item.tempId === existing.tempId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item,
                ),
              },
            };
          }

          // Add new item
          const newItem: CartItem = {
            tempId: uuidv4(),
            productId: product.productId,
            name: product.name,
            description: product.description,
            quantity: 1,
            uomCode: product.uomCode ?? 'EA',
            unitPrice: product.unitPrice,
            isGctExempt: product.isGctExempt ?? false,
          };

          return {
            currentCart: {
              ...state.currentCart,
              items: [...state.currentCart.items, newItem],
            },
          };
        });
      },

      updateCartItemQty: (tempId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(tempId);
          return;
        }
        set((state) => ({
          currentCart: {
            ...state.currentCart,
            items: state.currentCart.items.map((item) =>
              item.tempId === tempId ? { ...item, quantity } : item,
            ),
          },
        }));
      },

      updateCartItemDiscount: (tempId, discountType, discountValue) => {
        set((state) => ({
          currentCart: {
            ...state.currentCart,
            items: state.currentCart.items.map((item) =>
              item.tempId === tempId
                ? { ...item, discountType, discountValue }
                : item,
            ),
          },
        }));
      },

      removeFromCart: (tempId) => {
        set((state) => ({
          currentCart: {
            ...state.currentCart,
            items: state.currentCart.items.filter((item) => item.tempId !== tempId),
          },
        }));
      },

      clearCart: () => {
        set({
          currentCart: { ...EMPTY_CART },
          pendingOrderId: null,
          resumedOrderId: null,
          paymentStep: 'idle',
        });
      },

      setCartCustomer: (customerId, customerName) => {
        set((state) => ({
          currentCart: {
            ...state.currentCart,
            customerId,
            customerName,
          },
        }));
      },

      setCartDiscount: (type, value, reason) => {
        set((state) => ({
          currentCart: {
            ...state.currentCart,
            orderDiscountType: type,
            orderDiscountValue: value,
            orderDiscountReason: reason,
          },
        }));
      },

      getCartTotals: () => {
        const { currentCart, posSettings } = get();
        const gctRate = posSettings?.gctRate ?? 0.15;
        return calculateCartTotals(currentCart.items, gctRate, {
          type: currentCart.orderDiscountType,
          value: currentCart.orderDiscountValue,
          reason: currentCart.orderDiscountReason,
        });
      },

      loadFromHeldOrder: (order) => {
        const items: CartItem[] = (order.items ?? []).map((item) => ({
          tempId: uuidv4(),
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          uomCode: item.uomCode ?? 'EA',
          isGctExempt: item.isGctExempt ?? false,
          discountType: item.discountType,
          discountValue: item.discountValue,
          notes: item.notes,
        }));

        set({
          currentCart: {
            items,
            customerName: order.customerName ?? 'Walk-in',
          },
          resumedOrderId: order.id,
          pendingOrderId: null,
          paymentStep: 'idle',
        });
      },

      // ── Session Actions ───────────────────────────────────────

      setCurrentSession: (session) => set({ currentSession: session }),

      // ── Order Actions ─────────────────────────────────────────

      setHeldOrders: (orders) => set({ heldOrders: orders }),
      setPendingOrderId: (id) => set({ pendingOrderId: id }),
      setResumedOrderId: (id) => set({ resumedOrderId: id }),
      setPaymentStep: (step) => set({ paymentStep: step }),
      setLastCompletedOrder: (order) => set({ lastCompletedOrder: order }),

      // ── Product/Settings Cache ────────────────────────────────

      setProducts: (products) =>
        set({ products, productsLoadedAt: Date.now() }),

      setCategories: (categories) => set({ categories }),

      setPosSettings: (settings) => set({ posSettings: settings }),

      // ── Reset ─────────────────────────────────────────────────

      resetPosState: () =>
        set({
          currentCart: { ...EMPTY_CART },
          currentSession: null,
          heldOrders: [],
          pendingOrderId: null,
          resumedOrderId: null,
          paymentStep: 'idle',
          lastCompletedOrder: null,
          // Keep products and settings cached for next session
        }),
    }),
    {
      name: 'yaadbooks-kiosk-pos',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : ({
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
          length: 0,
          clear: () => {},
          key: () => null,
        } satisfies Storage),
      ),
      partialize: (state) => ({
        // Persist cart, session, and settings — not products (re-fetched)
        currentCart: state.currentCart,
        currentSession: state.currentSession,
        posSettings: state.posSettings,
        resumedOrderId: state.resumedOrderId,
      }),
    },
  ),
);

// ── Type Exports ─────────────────────────────────────────────────

export type {
  KioskPosSession,
  HeldOrderSummary,
  CompletedOrderInfo,
  CachedProduct,
  PaymentStep,
};
