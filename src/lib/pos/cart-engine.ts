/**
 * Shared POS Cart Calculation Engine
 *
 * Pure functions for financial calculations used by both the admin POS store
 * (src/store/posStore.ts) and the kiosk POS store (src/store/kioskPosStore.ts).
 *
 * All monetary math uses Decimal.js with precision: 20, ROUND_HALF_UP to
 * prevent floating-point errors (e.g. 0.1 + 0.2 !== 0.3).
 */
import Decimal from 'decimal.js';
import type {
  CartItem,
  PosOrderItem,
  PaymentMethodType,
} from '@/types/pos';

// ── Decimal.js Configuration ─────────────────────────────────────
// Matches src/lib/currency.ts and src/store/posStore.ts
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/** Round a Decimal to 2 decimal places and return a plain number. */
export const d2 = (v: Decimal): number => v.toDecimalPlaces(2).toNumber();

// ── Types ────────────────────────────────────────────────────────

export interface LineItemCalculation
  extends Omit<PosOrderItem, 'id' | 'lineNumber' | 'inventoryDeducted' | 'warehouseId' | 'orderId'> {}

export interface CartTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  exemptAmount: number;
  gctAmount: number;
  total: number;
  itemCount: number;
}

// ── Line Item Calculation ────────────────────────────────────────

/**
 * Calculate a single line item's totals.
 *
 * Flow:
 *   lineSubtotal = qty × unitPrice
 *   discountAmount = lineSubtotal × (percent / 100) OR fixed amount
 *   lineTotalBeforeTax = lineSubtotal - discountAmount
 *   gctAmount = lineTotalBeforeTax × gctRate (0 if exempt)
 *   lineTotal = lineTotalBeforeTax + gctAmount
 */
export function calculateLineItem(
  item: CartItem,
  gctRate: number,
): LineItemCalculation {
  const lineSubtotal = d2(new Decimal(item.quantity).times(item.unitPrice));

  let discountAmount = 0;
  if (item.discountType === 'percent' && item.discountValue) {
    discountAmount = d2(
      new Decimal(lineSubtotal).times(item.discountValue).dividedBy(100),
    );
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

// ── Cart Totals Calculation ──────────────────────────────────────

/**
 * Calculate aggregated totals for a cart of items with optional order-level discount.
 *
 * Flow:
 *   1. Sum all line items' lineTotalBeforeTax → subtotal
 *   2. Apply order discount (percent of subtotal, or fixed amount)
 *   3. Recalculate taxable/exempt proportionally using discount ratio
 *   4. GCT on adjusted taxable amount
 *   5. total = discountedSubtotal + gctAmount
 */
export function calculateCartTotals(
  items: CartItem[],
  gctRate: number,
  orderDiscount?: {
    type: 'percent' | 'amount' | undefined;
    value: number | undefined;
    reason?: string;
  },
): CartTotals {
  let subtotal = new Decimal(0);
  let taxableAmount = new Decimal(0);
  let exemptAmount = new Decimal(0);
  let gctAmount = new Decimal(0);
  let itemCount = 0;

  items.forEach((item) => {
    const calculated = calculateLineItem(item, gctRate);
    subtotal = subtotal.plus(calculated.lineTotalBeforeTax);
    if (item.isGctExempt) {
      exemptAmount = exemptAmount.plus(calculated.lineTotalBeforeTax);
    } else {
      taxableAmount = taxableAmount.plus(calculated.lineTotalBeforeTax);
    }
    gctAmount = gctAmount.plus(calculated.gctAmount);
    itemCount += Number(item.quantity);
  });

  // Apply order-level discount
  let discountAmount = new Decimal(0);
  if (orderDiscount?.type === 'percent' && orderDiscount.value) {
    discountAmount = subtotal.times(orderDiscount.value).dividedBy(100);
  } else if (orderDiscount?.type === 'amount' && orderDiscount.value) {
    discountAmount = new Decimal(orderDiscount.value);
  }

  // Proportional adjustment of taxable/exempt after order discount
  const discountedSubtotal = subtotal.minus(discountAmount);
  const discountRatio = subtotal.greaterThan(0)
    ? discountedSubtotal.dividedBy(subtotal)
    : new Decimal(1);
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
}

// ── Payment Method Labels ────────────────────────────────────────

/** Human-friendly label for a payment method. */
export function getPaymentMethodLabel(method: PaymentMethodType): string {
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
  return labels[method] ?? method;
}
