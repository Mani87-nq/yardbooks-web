/**
 * Currency utility functions using Decimal.js for precise financial calculations.
 * All monetary values should go through these utilities to avoid floating-point errors.
 */
import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Convert a major-unit amount (e.g., 19.99) to minor units (cents: 1999).
 * Always rounds to the nearest integer.
 */
export function toMinorUnits(amount: number): number {
  return new Decimal(amount).times(100).round().toNumber();
}

/**
 * Convert minor units (cents: 1999) back to major units (19.99).
 */
export function toMajorUnits(cents: number): number {
  return new Decimal(cents).dividedBy(100).toNumber();
}

/**
 * Precisely calculate a percentage of an amount.
 * e.g., calculatePercentage(100, 15) => 15.00
 */
export function calculatePercentage(amount: number, percentage: number): number {
  return new Decimal(amount)
    .times(new Decimal(percentage).dividedBy(100))
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Precisely multiply two numbers (e.g., price * quantity).
 */
export function multiply(a: number, b: number): number {
  return new Decimal(a).times(b).toDecimalPlaces(2).toNumber();
}

/**
 * Precisely divide two numbers.
 */
export function divide(a: number, b: number): number {
  if (b === 0) return 0;
  return new Decimal(a).dividedBy(b).toDecimalPlaces(2).toNumber();
}

/**
 * Precisely add an array of numbers.
 */
export function sumAmounts(amounts: number[]): number {
  return amounts
    .reduce((acc, val) => acc.plus(new Decimal(val)), new Decimal(0))
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Calculate line total: price * quantity, with optional discount percentage.
 */
export function calculateLineTotal(
  price: number,
  quantity: number,
  discountPercent: number = 0
): number {
  const subtotal = new Decimal(price).times(quantity);
  if (discountPercent > 0) {
    const discount = subtotal.times(new Decimal(discountPercent).dividedBy(100));
    return subtotal.minus(discount).toDecimalPlaces(2).toNumber();
  }
  return subtotal.toDecimalPlaces(2).toNumber();
}

/**
 * Calculate total from an array of line items.
 */
export function calculateTotal(
  items: { price: number; quantity: number; discountPercent?: number }[]
): number {
  return items
    .reduce((acc, item) => {
      const lineTotal = calculateLineTotal(item.price, item.quantity, item.discountPercent);
      return acc.plus(new Decimal(lineTotal));
    }, new Decimal(0))
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Calculate subtotal + tax amount from a subtotal and tax rate.
 * Returns { subtotal, taxAmount, total }
 */
export function calculateWithTax(
  subtotal: number,
  taxRatePercent: number
): { subtotal: number; taxAmount: number; total: number } {
  const sub = new Decimal(subtotal);
  const tax = sub.times(new Decimal(taxRatePercent).dividedBy(100)).toDecimalPlaces(2);
  const total = sub.plus(tax).toDecimalPlaces(2);
  return {
    subtotal: sub.toDecimalPlaces(2).toNumber(),
    taxAmount: tax.toNumber(),
    total: total.toNumber(),
  };
}

/**
 * Format currency for display.
 * @param amount The amount to format.
 * @param currency Currency code, defaults to 'JMD'.
 */
export function formatCurrencyPrecise(amount: number, currency: string = 'JMD'): string {
  const locale = currency === 'USD' ? 'en-US' : 'en-JM';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
