// Yaad Books Web - Point of Sale Store
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations (matches src/lib/currency.ts)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/** Round a Decimal to 2 dp and return a plain number. */
const d2 = (v: Decimal): number => v.toDecimalPlaces(2).toNumber();
import type {
  PosOrder,
  PosOrderItem,
  PosOrderStatus,
  PosPayment,
  PaymentMethodType,
  PaymentStatus,
  PosSession,
  PosSessionStatus,
  PosTerminal,
  PosSettings,
  PosCart,
  CartItem,
  CashMovement,
  CashMovementType,
  CreateOrderData,
  AddPaymentData,
  OpenSessionData,
  CloseSessionData,
  ZReport,
  PosReturn,
  PosReturnItem,
  ProductShortcut,
} from '@/types/pos';
import { DEFAULT_GRID_SETTINGS } from '@/types/pos';
import type { PosGridSettings } from '@/types/pos';

// ============================================
// STORE STATE INTERFACE
// ============================================

interface PosState {
  orders: PosOrder[];
  sessions: PosSession[];
  terminals: PosTerminal[];
  settings: PosSettings;
  zReports: ZReport[];
  currentCart: PosCart;
  currentSessionId: string | null;
  currentTerminalId: string | null;

  // Order Actions
  createOrderFromCart: (data: CreateOrderData) => PosOrder;
  getOrder: (id: string) => PosOrder | undefined;
  updateOrder: (id: string, updates: Partial<PosOrder>) => void;
  voidOrder: (id: string, reason: string) => void;
  completeOrder: (id: string) => void;
  holdOrder: (id: string, reason?: string) => void;
  resumeHeldOrder: (id: string) => void;
  getHeldOrders: () => PosOrder[];
  getOrdersBySession: (sessionId: string) => PosOrder[];
  getRecentOrders: (limit?: number) => PosOrder[];

  // Cart Actions
  addToCart: (item: Omit<CartItem, 'tempId'>) => void;
  updateCartItem: (tempId: string, updates: Partial<CartItem>) => void;
  removeFromCart: (tempId: string) => void;
  clearCart: () => void;
  setCartCustomer: (customerId: string | undefined, customerName: string) => void;
  setCartDiscount: (type: 'percent' | 'amount' | undefined, value: number | undefined, reason?: string) => void;
  calculateCartTotals: () => {
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    exemptAmount: number;
    gctAmount: number;
    total: number;
    itemCount: number;
  };

  // Payment Actions
  addPayment: (data: AddPaymentData) => PosPayment;
  updatePayment: (paymentId: string, updates: Partial<PosPayment>) => void;
  removePayment: (orderId: string, paymentId: string) => void;
  processPaymentComplete: (orderId: string, paymentId: string, reference?: string) => void;

  // Session Actions
  openSession: (data: OpenSessionData) => PosSession;
  closeSession: (data: CloseSessionData) => void;
  suspendSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;
  getSession: (id: string) => PosSession | undefined;
  getCurrentSession: () => PosSession | undefined;
  addCashMovement: (sessionId: string, type: CashMovementType, amount: number, reason?: string, orderId?: string) => void;

  // Terminal Actions
  addTerminal: (terminal: Omit<PosTerminal, 'id' | 'createdAt' | 'updatedAt'>) => PosTerminal;
  updateTerminal: (id: string, updates: Partial<PosTerminal>) => void;
  setCurrentTerminal: (terminalId: string | null) => void;
  getTerminal: (id: string) => PosTerminal | undefined;

  // Settings Actions
  updateSettings: (updates: Partial<PosSettings>) => void;

  // Report Actions
  generateZReport: (sessionId: string, generatedBy: string) => ZReport;
  getZReport: (id: string) => ZReport | undefined;

  // Return Actions
  returns: PosReturn[];
  processReturn: (
    orderId: string,
    itemsToReturn: { itemId: string; quantity: number; condition?: 'resellable' | 'damaged' | 'defective' }[],
    reason: string,
    reasonCategory: string,
    refundMethod: PaymentMethodType,
    processedBy: string,
  ) => { returnNumber: string; totalRefund: number } | null;
  getReturnableQuantity: (orderId: string, itemId: string) => number;
  getReturnsByOrder: (orderId: string) => PosReturn[];

  // Grid Settings Actions
  gridSettings: PosGridSettings;
  gridShortcuts: ProductShortcut[];
  updateGridSettings: (updates: Partial<PosGridSettings>) => void;
  addGridShortcut: (shortcut: Omit<ProductShortcut, 'position'>) => void;
  removeGridShortcut: (productId: string) => void;
  updateGridShortcut: (productId: string, updates: Partial<ProductShortcut>) => void;
  reorderGridShortcuts: (shortcuts: ProductShortcut[]) => void;
  // Branch-compatible aliases for grid-settings page
  addProductShortcut: (productId: string, color: string, icon: string) => void;
  removeProductShortcut: (productId: string) => void;
  reorderShortcuts: (shortcuts: ProductShortcut[]) => void;
  updateShortcutColor: (productId: string, color: string) => void;
  updateShortcutIcon: (productId: string, icon: string) => void;
  resetGridToDefaults: () => void;

  // Utility
  generateOrderNumber: () => string;
}

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_SETTINGS: PosSettings = {
  orderPrefix: 'POS-',
  nextOrderNumber: 1,
  gctRate: 0.15,
  taxIncludedInPrice: false,
  businessName: '',
  showLogo: true,
  requireOpenSession: true,
  allowOfflineSales: true,
  autoDeductInventory: true,
  autoPostToGL: true,
  defaultToWalkIn: true,
  updatedAt: new Date(),
};

const EMPTY_CART: PosCart = {
  items: [],
  customerName: 'Walk-in',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateLineItem(item: CartItem, gctRate: number): Omit<PosOrderItem, 'id' | 'lineNumber' | 'inventoryDeducted' | 'warehouseId'> {
  const lineSubtotal = d2(new Decimal(item.quantity).times(item.unitPrice));

  let discountAmount = 0;
  if (item.discountType === 'percent' && item.discountValue) {
    discountAmount = d2(new Decimal(lineSubtotal).times(item.discountValue).dividedBy(100));
  } else if (item.discountType === 'amount' && item.discountValue) {
    discountAmount = item.discountValue;
  }

  const lineTotalBeforeTax = d2(new Decimal(lineSubtotal).minus(discountAmount));
  const effectiveGctRate = item.isGctExempt ? 0 : gctRate;
  const gctAmount = d2(new Decimal(lineTotalBeforeTax).times(effectiveGctRate));
  const lineTotal = d2(new Decimal(lineTotalBeforeTax).plus(gctAmount));

  return {
    productId: item.productId,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    uomCode: item.uomCode,
    unitPrice: item.unitPrice,
    lineSubtotal,
    discountType: item.discountType,
    discountValue: item.discountValue,
    discountAmount,
    lineTotalBeforeTax,
    isGctExempt: item.isGctExempt,
    gctRate: effectiveGctRate,
    gctAmount,
    lineTotal,
    notes: item.notes,
  };
}

function getPaymentMethodLabel(method: PaymentMethodType): string {
  const labels: Record<PaymentMethodType, string> = {
    cash: 'Cash',
    jam_dex: 'JAM-DEX',
    lynk_wallet: 'Lynk Wallet',
    wipay: 'WiPay',
    card_visa: 'Visa',
    card_mastercard: 'Mastercard',
    card_other: 'Card',
    bank_transfer: 'Bank Transfer',
    store_credit: 'Store Credit',
    other: 'Other',
  };
  return labels[method];
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      orders: [],
      sessions: [],
      terminals: [],
      settings: DEFAULT_SETTINGS,
      zReports: [],
      currentCart: EMPTY_CART,
      currentSessionId: null,
      currentTerminalId: null,
      returns: [],
      gridSettings: DEFAULT_GRID_SETTINGS,
      gridShortcuts: [],

      generateOrderNumber: () => {
        const { settings } = get();
        const year = new Date().getFullYear();
        const number = settings.nextOrderNumber.toString().padStart(6, '0');
        const orderNumber = `${settings.orderPrefix}${year}-${number}`;

        set((state) => ({
          settings: {
            ...state.settings,
            nextOrderNumber: state.settings.nextOrderNumber + 1,
          },
        }));

        return orderNumber;
      },

      createOrderFromCart: (data) => {
        const { generateOrderNumber, settings } = get();
        const { cart, sessionId, terminalId } = data;
        const gctRate = settings.gctRate;

        const items: PosOrderItem[] = cart.items.map((cartItem, index) => {
          const calculated = calculateLineItem(cartItem, gctRate);
          return {
            id: uuidv4(),
            lineNumber: index + 1,
            ...calculated,
            inventoryDeducted: false,
          };
        });

        let subtotal = 0;
        let taxableAmount = 0;
        let exemptAmount = 0;
        let gctAmount = 0;
        let itemCount = 0;

        items.forEach((item) => {
          subtotal += item.lineTotalBeforeTax;
          if (item.isGctExempt) {
            exemptAmount += item.lineTotalBeforeTax;
          } else {
            taxableAmount += item.lineTotalBeforeTax;
          }
          gctAmount += item.gctAmount;
          itemCount += item.quantity;
        });

        let orderDiscountAmount = 0;
        if (cart.orderDiscountType === 'percent' && cart.orderDiscountValue) {
          orderDiscountAmount = subtotal * (cart.orderDiscountValue / 100);
        } else if (cart.orderDiscountType === 'amount' && cart.orderDiscountValue) {
          orderDiscountAmount = cart.orderDiscountValue;
        }

        const discountedSubtotal = subtotal - orderDiscountAmount;
        const discountRatio = discountedSubtotal / subtotal;
        taxableAmount = taxableAmount * discountRatio;
        exemptAmount = exemptAmount * discountRatio;
        gctAmount = taxableAmount * gctRate;

        const total = discountedSubtotal + gctAmount;

        const now = new Date();
        const order: PosOrder = {
          id: uuidv4(),
          orderNumber: generateOrderNumber(),
          sessionId,
          terminalId,
          customerId: cart.customerId,
          customerName: cart.customerName || 'Walk-in',
          items,
          itemCount,
          subtotal,
          orderDiscountType: cart.orderDiscountType,
          orderDiscountValue: cart.orderDiscountValue,
          orderDiscountAmount,
          orderDiscountReason: cart.orderDiscountReason,
          taxableAmount,
          exemptAmount,
          gctRate,
          gctAmount,
          total,
          payments: [],
          amountPaid: 0,
          amountDue: total,
          changeGiven: 0,
          status: 'pending_payment',
          receiptPrinted: false,
          isOfflineOrder: false,
          createdAt: now,
          updatedAt: now,
          createdBy: 'Cashier',
          notes: cart.notes,
        };

        set((state) => ({
          orders: [...state.orders, order],
          currentCart: EMPTY_CART,
        }));

        return order;
      },

      getOrder: (id) => get().orders.find((o) => o.id === id),

      updateOrder: (id, updates) => {
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, ...updates, updatedAt: new Date() } : o
          ),
        }));
      },

      voidOrder: (id, reason) => {
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id
              ? { ...o, status: 'voided' as PosOrderStatus, voidReason: reason, updatedAt: new Date() }
              : o
          ),
        }));
      },

      completeOrder: (id) => {
        const order = get().getOrder(id);
        if (!order) return;

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: 'completed' as PosOrderStatus,
                  completedAt: new Date(),
                  updatedAt: new Date(),
                }
              : o
          ),
        }));

        if (order.sessionId) {
          const session = get().getSession(order.sessionId);
          if (session && !session.orderIds.includes(id)) {
            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === order.sessionId
                  ? { ...s, orderIds: [...s.orderIds, id], updatedAt: new Date() }
                  : s
              ),
            }));
          }
        }
      },

      holdOrder: (id, reason) => {
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id
              ? { ...o, status: 'held' as PosOrderStatus, heldReason: reason, updatedAt: new Date() }
              : o
          ),
        }));
      },

      resumeHeldOrder: (id) => {
        const order = get().getOrder(id);
        if (!order || order.status !== 'held') return;

        const cart: PosCart = {
          items: order.items.map((item) => ({
            tempId: uuidv4(),
            productId: item.productId,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            uomCode: item.uomCode,
            unitPrice: item.unitPrice,
            isGctExempt: item.isGctExempt,
            discountType: item.discountType,
            discountValue: item.discountValue,
            notes: item.notes,
          })),
          customerId: order.customerId,
          customerName: order.customerName,
          orderDiscountType: order.orderDiscountType,
          orderDiscountValue: order.orderDiscountValue,
          orderDiscountReason: order.orderDiscountReason,
          notes: order.notes,
        };

        set({ currentCart: cart });

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id
              ? { ...o, status: 'draft' as PosOrderStatus, heldReason: undefined, updatedAt: new Date() }
              : o
          ),
        }));
      },

      getHeldOrders: () => get().orders.filter((o) => o.status === 'held'),

      getOrdersBySession: (sessionId) => get().orders.filter((o) => o.sessionId === sessionId),

      getRecentOrders: (limit = 50) => {
        return [...get().orders]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, limit);
      },

      // Cart Actions
      addToCart: (item) => {
        const newItem: CartItem = {
          ...item,
          tempId: uuidv4(),
        };

        set((state) => ({
          currentCart: {
            ...state.currentCart,
            items: [...state.currentCart.items, newItem],
          },
        }));
      },

      updateCartItem: (tempId, updates) => {
        set((state) => ({
          currentCart: {
            ...state.currentCart,
            items: state.currentCart.items.map((item) =>
              item.tempId === tempId ? { ...item, ...updates } : item
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

      clearCart: () => set({ currentCart: EMPTY_CART }),

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

      calculateCartTotals: () => {
        const { currentCart, settings } = get();
        const gctRate = settings.gctRate;

        let subtotal = new Decimal(0);
        let taxableAmount = new Decimal(0);
        let exemptAmount = new Decimal(0);
        let gctAmount = new Decimal(0);
        let itemCount = 0;

        currentCart.items.forEach((item) => {
          const calculated = calculateLineItem(item, gctRate);
          subtotal = subtotal.plus(calculated.lineTotalBeforeTax);
          if (item.isGctExempt) {
            exemptAmount = exemptAmount.plus(calculated.lineTotalBeforeTax);
          } else {
            taxableAmount = taxableAmount.plus(calculated.lineTotalBeforeTax);
          }
          gctAmount = gctAmount.plus(calculated.gctAmount);
          itemCount += item.quantity;
        });

        let discountAmount = new Decimal(0);
        if (currentCart.orderDiscountType === 'percent' && currentCart.orderDiscountValue) {
          discountAmount = subtotal.times(currentCart.orderDiscountValue).dividedBy(100);
        } else if (currentCart.orderDiscountType === 'amount' && currentCart.orderDiscountValue) {
          discountAmount = new Decimal(currentCart.orderDiscountValue);
        }

        const discountedSubtotal = subtotal.minus(discountAmount);
        const discountRatio = subtotal.greaterThan(0) ? discountedSubtotal.dividedBy(subtotal) : new Decimal(1);
        taxableAmount = taxableAmount.times(discountRatio);
        exemptAmount = exemptAmount.times(discountRatio);
        gctAmount = taxableAmount.times(gctRate);

        const total = discountedSubtotal.plus(gctAmount);

        return {
          subtotal: d2(subtotal),
          discountAmount: d2(discountAmount),
          taxableAmount: d2(taxableAmount),
          exemptAmount: d2(exemptAmount),
          gctAmount: d2(gctAmount),
          total: d2(total),
          itemCount,
        };
      },

      // Payment Actions
      addPayment: (data) => {
        const now = new Date();
        const payment: PosPayment = {
          id: uuidv4(),
          orderId: data.orderId,
          method: data.method,
          amount: data.amount,
          currency: 'JMD',
          amountTendered: data.amountTendered,
          reference: data.reference,
          status: data.method === 'cash' ? 'completed' : 'pending',
          createdAt: now,
          updatedAt: now,
        };

        if (data.method === 'cash' && data.amountTendered) {
          payment.changeGiven = d2(Decimal.max(0, new Decimal(data.amountTendered).minus(data.amount)));
          payment.processedAt = now;
        }

        const order = get().getOrder(data.orderId);
        if (order) {
          const newPayments = [...order.payments, payment];
          const amountPaid = d2(newPayments
            .filter((p) => p.status === 'completed')
            .reduce((sum, p) => sum.plus(p.amount), new Decimal(0)));
          const amountDue = d2(Decimal.max(0, new Decimal(order.total).minus(amountPaid)));
          const changeGiven = d2(newPayments.reduce((sum, p) => sum.plus(p.changeGiven || 0), new Decimal(0)));

          set((state) => ({
            orders: state.orders.map((o) =>
              o.id === data.orderId
                ? {
                    ...o,
                    payments: newPayments,
                    amountPaid,
                    amountDue,
                    changeGiven,
                    updatedAt: new Date(),
                  }
                : o
            ),
          }));
        }

        return payment;
      },

      updatePayment: (paymentId, updates) => {
        set((state) => ({
          orders: state.orders.map((order) => ({
            ...order,
            payments: order.payments.map((p) =>
              p.id === paymentId ? { ...p, ...updates, updatedAt: new Date() } : p
            ),
          })),
        }));
      },

      removePayment: (orderId, paymentId) => {
        const order = get().getOrder(orderId);
        if (!order) return;

        const newPayments = order.payments.filter((p) => p.id !== paymentId);
        const amountPaid = d2(newPayments
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum.plus(p.amount), new Decimal(0)));
        const amountDue = d2(Decimal.max(0, new Decimal(order.total).minus(amountPaid)));

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? { ...o, payments: newPayments, amountPaid, amountDue, updatedAt: new Date() }
              : o
          ),
        }));
      },

      processPaymentComplete: (orderId, paymentId, reference) => {
        const order = get().getOrder(orderId);
        if (!order) return;

        const now = new Date();
        const newPayments = order.payments.map((p) =>
          p.id === paymentId
            ? { ...p, status: 'completed' as PaymentStatus, reference, processedAt: now, updatedAt: now }
            : p
        );

        const amountPaid = d2(newPayments
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum.plus(p.amount), new Decimal(0)));
        const amountDue = d2(Decimal.max(0, new Decimal(order.total).minus(amountPaid)));

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? { ...o, payments: newPayments, amountPaid, amountDue, updatedAt: now }
              : o
          ),
        }));

        if (amountDue <= 0) {
          get().completeOrder(orderId);
        }
      },

      // Session Actions
      openSession: (data) => {
        const now = new Date();
        const session: PosSession = {
          id: uuidv4(),
          terminalId: data.terminalId,
          terminalName: get().getTerminal(data.terminalId)?.name || 'Unknown',
          cashierName: data.cashierName,
          cashierId: data.cashierId,
          openedAt: now,
          openingCash: data.openingCash,
          cashMovements: [
            {
              id: uuidv4(),
              sessionId: '',
              type: 'opening_float',
              amount: data.openingCash,
              performedBy: data.cashierName,
              performedAt: now,
            },
          ],
          expectedCash: data.openingCash,
          orderIds: [],
          totalSales: 0,
          totalRefunds: 0,
          totalVoids: 0,
          netSales: 0,
          paymentBreakdown: [],
          status: 'open',
          createdAt: now,
          updatedAt: now,
        };

        session.cashMovements[0].sessionId = session.id;

        set((state) => ({
          sessions: [...state.sessions, session],
          currentSessionId: session.id,
        }));

        set((state) => ({
          terminals: state.terminals.map((t) =>
            t.id === data.terminalId
              ? { ...t, currentSessionId: session.id, updatedAt: now }
              : t
          ),
        }));

        return session;
      },

      closeSession: (data) => {
        const session = get().getSession(data.sessionId);
        if (!session) return;

        const now = new Date();
        const variance = d2(new Decimal(data.closingCash).minus(session.expectedCash));

        const closingMovement: CashMovement = {
          id: uuidv4(),
          sessionId: data.sessionId,
          type: 'closing_count',
          amount: data.closingCash,
          reason: `Closing count. Variance: ${variance >= 0 ? '+' : ''}${variance.toFixed(2)}`,
          performedBy: session.cashierName,
          performedAt: now,
        };

        const sessionOrders = get().getOrdersBySession(data.sessionId);
        const completedOrders = sessionOrders.filter((o) => o.status === 'completed');
        const voidedOrders = sessionOrders.filter((o) => o.status === 'voided');
        const refundedOrders = sessionOrders.filter((o) => o.status === 'refunded');

        const totalSales = d2(completedOrders.reduce((sum, o) => sum.plus(o.total), new Decimal(0)));
        const totalRefunds = d2(refundedOrders.reduce((sum, o) => sum.plus(o.total), new Decimal(0)));
        const netSales = d2(new Decimal(totalSales).minus(totalRefunds));

        const paymentMap = new Map<PaymentMethodType, { count: number; total: Decimal }>();
        completedOrders.forEach((order) => {
          order.payments
            .filter((p) => p.status === 'completed')
            .forEach((payment) => {
              const existing = paymentMap.get(payment.method) || { count: 0, total: new Decimal(0) };
              paymentMap.set(payment.method, {
                count: existing.count + 1,
                total: existing.total.plus(payment.amount),
              });
            });
        });

        const paymentBreakdown = Array.from(paymentMap.entries()).map(([method, pData]) => ({
          method,
          count: pData.count,
          total: d2(pData.total),
        }));

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === data.sessionId
              ? {
                  ...s,
                  closedAt: now,
                  closingCash: data.closingCash,
                  cashVariance: variance,
                  cashMovements: [...s.cashMovements, closingMovement],
                  totalSales,
                  totalRefunds,
                  totalVoids: voidedOrders.length,
                  netSales,
                  paymentBreakdown,
                  status: 'closed' as PosSessionStatus,
                  closingNotes: data.closingNotes,
                  updatedAt: now,
                }
              : s
          ),
          currentSessionId: state.currentSessionId === data.sessionId ? null : state.currentSessionId,
        }));

        set((state) => ({
          terminals: state.terminals.map((t) =>
            t.currentSessionId === data.sessionId
              ? { ...t, currentSessionId: undefined, updatedAt: now }
              : t
          ),
        }));
      },

      suspendSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, status: 'suspended' as PosSessionStatus, updatedAt: new Date() }
              : s
          ),
        }));
      },

      resumeSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, status: 'open' as PosSessionStatus, updatedAt: new Date() }
              : s
          ),
          currentSessionId: sessionId,
        }));
      },

      getSession: (id) => get().sessions.find((s) => s.id === id),

      getCurrentSession: () => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return undefined;
        return sessions.find((s) => s.id === currentSessionId);
      },

      addCashMovement: (sessionId, type, amount, reason, orderId) => {
        const session = get().getSession(sessionId);
        if (!session) return;

        const movement: CashMovement = {
          id: uuidv4(),
          sessionId,
          type,
          amount,
          orderId,
          reason,
          performedBy: session.cashierName,
          performedAt: new Date(),
        };

        let expected = new Decimal(session.expectedCash);
        if (type === 'sale' || type === 'payout') {
          expected = expected.plus(amount);
        } else if (type === 'refund') {
          expected = expected.minus(new Decimal(amount).abs());
        } else if (type === 'drop') {
          expected = expected.minus(new Decimal(amount).abs());
        } else if (type === 'adjustment') {
          expected = expected.plus(amount);
        }
        const expectedCash = d2(expected);

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  cashMovements: [...s.cashMovements, movement],
                  expectedCash,
                  updatedAt: new Date(),
                }
              : s
          ),
        }));
      },

      // Terminal Actions
      addTerminal: (terminalData) => {
        const now = new Date();
        const terminal: PosTerminal = {
          ...terminalData,
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          terminals: [...state.terminals, terminal],
        }));

        return terminal;
      },

      updateTerminal: (id, updates) => {
        set((state) => ({
          terminals: state.terminals.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
          ),
        }));
      },

      setCurrentTerminal: (terminalId) => set({ currentTerminalId: terminalId }),

      getTerminal: (id) => get().terminals.find((t) => t.id === id),

      // Settings Actions
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates, updatedAt: new Date() },
        }));
      },

      // Report Actions
      generateZReport: (sessionId, generatedBy) => {
        const session = get().getSession(sessionId);
        if (!session) throw new Error('Session not found');

        const sessionOrders = get().getOrdersBySession(sessionId);
        const completedOrders = sessionOrders.filter((o) => o.status === 'completed');
        const voidedOrders = sessionOrders.filter((o) => o.status === 'voided');
        const refundedOrders = sessionOrders.filter((o) => o.status === 'refunded');

        const grossSales = d2(completedOrders.reduce((sum, o) => sum.plus(o.subtotal), new Decimal(0)));
        const discounts = d2(completedOrders.reduce((sum, o) => sum.plus(o.orderDiscountAmount), new Decimal(0)));
        const refunds = d2(refundedOrders.reduce((sum, o) => sum.plus(o.total), new Decimal(0)));
        const netSales = d2(new Decimal(grossSales).minus(discounts).minus(refunds));
        const taxableAmount = d2(completedOrders.reduce((sum, o) => sum.plus(o.taxableAmount), new Decimal(0)));
        const exemptAmount = d2(completedOrders.reduce((sum, o) => sum.plus(o.exemptAmount), new Decimal(0)));
        const gctCollected = d2(completedOrders.reduce((sum, o) => sum.plus(o.gctAmount), new Decimal(0)));

        const zPaymentMap = new Map<PaymentMethodType, { count: number; total: Decimal }>();
        completedOrders.forEach((order) => {
          order.payments
            .filter((p) => p.status === 'completed')
            .forEach((payment) => {
              const existing = zPaymentMap.get(payment.method) || { count: 0, total: new Decimal(0) };
              zPaymentMap.set(payment.method, {
                count: existing.count + 1,
                total: existing.total.plus(payment.amount),
              });
            });
        });

        const paymentBreakdown = Array.from(zPaymentMap.entries()).map(([method, pData]) => ({
          method,
          methodLabel: getPaymentMethodLabel(method),
          transactionCount: pData.count,
          total: d2(pData.total),
        }));

        const cashPayments = paymentBreakdown.find((p) => p.method === 'cash');
        const cashSales = cashPayments?.total || 0;
        const cashRefunds = d2(refundedOrders
          .flatMap((o) => o.payments)
          .filter((p) => p.method === 'cash' && p.status === 'refunded')
          .reduce((sum, p) => sum.plus(p.amount), new Decimal(0)));
        const cashPayouts = d2(session.cashMovements
          .filter((m) => m.type === 'payout' || m.type === 'drop')
          .reduce((sum, m) => sum.plus(new Decimal(m.amount).abs()), new Decimal(0)));

        const now = new Date();
        const reportNumber = `Z-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${get().zReports.length + 1}`;

        const zReport: ZReport = {
          id: uuidv4(),
          reportNumber,
          date: now,
          terminalId: session.terminalId,
          terminalName: session.terminalName,
          periodStart: session.openedAt,
          periodEnd: session.closedAt || now,
          totalTransactions: sessionOrders.length,
          completedTransactions: completedOrders.length,
          voidedTransactions: voidedOrders.length,
          refundedTransactions: refundedOrders.length,
          grossSales,
          discounts,
          refunds,
          netSales,
          taxableAmount,
          exemptAmount,
          gctCollected,
          paymentBreakdown,
          openingCash: session.openingCash,
          cashSales,
          cashRefunds,
          cashPayouts,
          expectedCash: session.expectedCash,
          actualCash: session.closingCash || 0,
          variance: session.cashVariance || 0,
          generatedAt: now,
          generatedBy,
        };

        set((state) => ({
          zReports: [...state.zReports, zReport],
        }));

        return zReport;
      },

      getZReport: (id) => get().zReports.find((r) => r.id === id),

      // ============================================
      // RETURN ACTIONS
      // ============================================

      processReturn: (orderId, itemsToReturn, reason, _reasonCategory, refundMethod, processedBy) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return null;

        const now = new Date();
        const returnNumber = `RTN-${now.getFullYear()}-${(get().returns.length + 1).toString().padStart(4, '0')}`;

        // Build return items and calculate total
        let totalRefundDec = new Decimal(0);
        const returnItems: PosReturnItem[] = itemsToReturn.map((item) => {
          const orderItem = order.items.find((i) => i.id === item.itemId);
          if (!orderItem) return null;
          const unitPrice = d2(new Decimal(orderItem.lineTotal).dividedBy(orderItem.quantity));
          const refundAmount = d2(new Decimal(unitPrice).times(item.quantity));
          totalRefundDec = totalRefundDec.plus(refundAmount);
          return {
            id: uuidv4(),
            orderItemId: item.itemId,
            productId: orderItem.productId,
            name: orderItem.name,
            sku: orderItem.sku,
            quantity: item.quantity,
            unitPrice: orderItem.unitPrice,
            refundAmount,
            returnReason: 'other' as const,
            condition: item.condition || 'resellable',
            restockItem: item.condition === 'resellable' || !item.condition,
          };
        }).filter(Boolean) as PosReturnItem[];

        if (returnItems.length === 0) return null;

        const totalRefund = d2(totalRefundDec);
        const posReturn: PosReturn = {
          id: uuidv4(),
          orderId,
          orderNumber: order.orderNumber,
          sessionId: get().currentSessionId || undefined,
          terminalId: get().currentTerminalId || undefined,
          customerId: order.customerId,
          customerName: order.customerName,
          items: returnItems,
          totalRefundAmount: totalRefund,
          refundMethod: refundMethod === 'store_credit' ? 'store_credit' : refundMethod === 'jam_dex' ? 'original_method' : 'cash',
          status: 'completed',
          returnReason: 'other',
          notes: reason,
          processedBy,
          createdAt: now,
          completedAt: now,
        };

        // Update order status to 'refunded'
        set((state) => ({
          returns: [...state.returns, posReturn],
          orders: state.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: 'refunded' as PosOrderStatus, refundReason: reason, updatedAt: now }
              : o
          ),
        }));

        // Add cash movement to session if cash refund
        if (refundMethod === 'cash' && get().currentSessionId) {
          get().addCashMovement(
            get().currentSessionId!,
            'refund',
            -Math.abs(totalRefund),
            `Return: ${returnNumber}`,
          );
        }

        return { returnNumber, totalRefund };
      },

      getReturnableQuantity: (orderId, itemId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return 0;

        // Find item by ID (order item ID)
        const orderItem = order.items.find((i) => i.id === itemId);
        if (!orderItem) return 0;

        // Sum quantities already returned for this item
        const alreadyReturned = get().returns
          .filter((r) => r.orderId === orderId && r.status !== 'rejected')
          .flatMap((r) => r.items)
          .filter((i) => i.orderItemId === itemId)
          .reduce((sum, i) => sum + i.quantity, 0);

        return Math.max(0, orderItem.quantity - alreadyReturned);
      },

      getReturnsByOrder: (orderId) => get().returns.filter((r) => r.orderId === orderId),

      // ============================================
      // GRID SETTINGS ACTIONS
      // ============================================

      updateGridSettings: (updates) => {
        set((state) => ({
          gridSettings: { ...state.gridSettings, ...updates },
        }));
      },

      addGridShortcut: (shortcut) => {
        set((state) => {
          const maxPosition = state.gridShortcuts.reduce((max, s) => Math.max(max, s.position), 0);
          const newShortcut: ProductShortcut = {
            ...shortcut,
            position: maxPosition + 1,
          };
          return {
            gridShortcuts: [...state.gridShortcuts, newShortcut],
          };
        });
      },

      removeGridShortcut: (productId) => {
        set((state) => ({
          gridShortcuts: state.gridShortcuts.filter((s) => s.productId !== productId),
        }));
      },

      updateGridShortcut: (productId, updates) => {
        set((state) => ({
          gridShortcuts: state.gridShortcuts.map((s) =>
            s.productId === productId ? { ...s, ...updates } : s
          ),
        }));
      },

      reorderGridShortcuts: (shortcuts) => {
        set({ gridShortcuts: shortcuts });
      },

      // Branch-compatible aliases for grid-settings page
      addProductShortcut: (productId, color, icon) => {
        get().addGridShortcut({ productId, color, icon });
      },
      removeProductShortcut: (productId) => {
        get().removeGridShortcut(productId);
      },
      reorderShortcuts: (shortcuts) => {
        get().reorderGridShortcuts(shortcuts);
      },
      updateShortcutColor: (productId, color) => {
        get().updateGridShortcut(productId, { color });
      },
      updateShortcutIcon: (productId, icon) => {
        get().updateGridShortcut(productId, { icon });
      },
      resetGridToDefaults: () => {
        set({
          gridSettings: { ...DEFAULT_GRID_SETTINGS },
          gridShortcuts: [],
        });
      },
    }),
    {
      name: 'yaadbooks-pos-web',
      storage: createJSONStorage(() => localStorage),
      // Only persist non-sensitive configuration data.
      // Orders, sessions, carts, and returns contain customer PII and
      // payment details — these must NOT be stored in cleartext localStorage.
      partialize: (state) => ({
        terminals: state.terminals,
        settings: state.settings,
        gridSettings: state.gridSettings,
        gridShortcuts: state.gridShortcuts,
        currentTerminalId: state.currentTerminalId,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const useTodayOrders = () => {
  const orders = usePosStore((state) => state.orders);

  // Calculate today's start time once per render, not inside selector
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  return orders.filter(
    (o) =>
      o.status === 'completed' &&
      new Date(o.completedAt || o.createdAt).getTime() >= todayTime
  );
};

export const useActiveTerminals = () => {
  return usePosStore((state) =>
    state.terminals.filter((t) => t.isActive)
  );
};

export const useOpenSessions = () => {
  return usePosStore((state) =>
    state.sessions.filter((s) => s.status === 'open')
  );
};
