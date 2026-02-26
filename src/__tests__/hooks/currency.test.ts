/**
 * Currency Formatting Safety Tests
 *
 * These tests verify the critical Prisma Decimal → Number conversion
 * that was causing the $NaN and $1,200,027,600 bugs.
 *
 * The useCurrency hook is a React hook and requires React rendering,
 * so here we test the standalone helpers that don't need React context.
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/lib/utils';

describe('Currency Formatting — Decimal Safety', () => {
  // ──────────────────────────────────────────
  // The Bug: Prisma Decimal serializes as string
  // ──────────────────────────────────────────

  describe('Number() coercion safety (Prisma Decimal strings)', () => {
    it('should handle string "12000" as number 12000', () => {
      const amount = Number('12000' as unknown as number) || 0;
      expect(amount).toBe(12000);
      expect(formatCurrency(amount, 'JMD')).toContain('12,000');
    });

    it('should handle string "345.00" as number 345', () => {
      const amount = Number('345.00' as unknown as number) || 0;
      expect(amount).toBe(345);
    });

    it('should handle actual number 12000 unchanged', () => {
      const amount = Number(12000) || 0;
      expect(amount).toBe(12000);
    });

    it('should handle null as 0', () => {
      const amount = Number(null as unknown as number) || 0;
      expect(amount).toBe(0);
    });

    it('should handle undefined as 0', () => {
      const amount = Number(undefined as unknown as number) || 0;
      expect(amount).toBe(0);
    });

    it('should handle empty string as 0', () => {
      const amount = Number('' as unknown as number) || 0;
      expect(amount).toBe(0);
    });

    it('should handle NaN-producing values as 0', () => {
      const amount = Number('not-a-number' as unknown as number) || 0;
      expect(amount).toBe(0);
    });
  });

  // ──────────────────────────────────────────
  // The Original Bug: String concatenation in reduce
  // ──────────────────────────────────────────

  describe('reduce with Decimal strings (the original bug)', () => {
    it('should NOT concatenate strings when using Number()', () => {
      // Simulating Prisma Decimal values coming as strings
      const invoices = [
        { balance: '12000' as unknown as number },
        { balance: '27600' as unknown as number },
      ];

      // THE BUG (without Number()): 0 + "12000" + "27600" = "01200027600"
      const buggyTotal = invoices.reduce((sum, inv) => sum + (inv.balance as unknown as number), 0);
      expect(buggyTotal).toBe('01200027600'); // This is what was happening!

      // THE FIX (with Number()): 0 + 12000 + 27600 = 39600
      const correctTotal = invoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
      expect(correctTotal).toBe(39600);
    });

    it('should handle mixed number and string values', () => {
      const items = [
        { amount: 100 },          // actual number
        { amount: '200.50' as unknown as number },  // Prisma Decimal string
        { amount: '300' as unknown as number },      // Prisma Decimal string
      ];

      const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      expect(total).toBe(600.50);
    });

    it('should handle all-null values', () => {
      const items = [
        { amount: null as unknown as number },
        { amount: null as unknown as number },
      ];

      const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      expect(total).toBe(0);
    });
  });

  // ──────────────────────────────────────────
  // Currency formatting with coerced values
  // ──────────────────────────────────────────

  describe('formatCurrency with various input types', () => {
    it('should format correctly after Number() coercion', () => {
      const stringAmount = '39600' as unknown as number;
      const result = formatCurrency(Number(stringAmount) || 0, 'JMD');
      expect(result).toContain('39,600');
      expect(result).toContain('.00');
    });

    it('should format zero correctly', () => {
      const result = formatCurrency(Number(null) || 0, 'JMD');
      expect(result).toContain('0.00');
    });

    it('should format negative amounts', () => {
      const result = formatCurrency(Number('-500.25') || 0, 'JMD');
      expect(result).toContain('500.25');
    });

    it('should handle Decimal.js-like string values', () => {
      // Decimal.js toString() outputs like this
      const decimalString = '10455.80';
      const result = formatCurrency(Number(decimalString) || 0, 'JMD');
      expect(result).toContain('10,455.80');
    });
  });

  // ──────────────────────────────────────────
  // Multi-currency
  // ──────────────────────────────────────────

  describe('Multi-currency support', () => {
    it('should format JMD (Jamaica Dollar)', () => {
      const result = formatCurrency(1500, 'JMD');
      expect(result).toContain('1,500');
    });

    it('should format USD (US Dollar)', () => {
      const result = formatCurrency(1500, 'USD');
      expect(result).toContain('$');
      expect(result).toContain('1,500');
    });

    it('should format GBP (British Pound)', () => {
      const result = formatCurrency(1500, 'GBP');
      expect(result).toContain('1,500');
    });

    it('should format BBD (Barbados Dollar)', () => {
      const result = formatCurrency(1500, 'BBD');
      expect(result).toContain('1,500');
    });

    it('should format TTD (Trinidad Dollar)', () => {
      const result = formatCurrency(1500, 'TTD');
      expect(result).toContain('1,500');
    });
  });
});
