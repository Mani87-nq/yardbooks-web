/**
 * Utility Functions Tests
 *
 * Tests for currency formatting, date formatting, GCT calculations,
 * validation, and string utilities.
 */
import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatJMD,
  formatUSD,
  formatNumber,
  formatPercent,
  formatDate,
  formatRelativeTime,
  GCT_RATES,
  getGCTRate,
  calculateGCT,
  calculateTotalWithGCT,
  getInvoiceStatusColor,
  getInvoiceStatusLabel,
  getExpenseCategoryLabel,
  getPaymentMethodLabel,
  formatAddress,
  isValidTRN,
  isValidNIS,
  isValidEmail,
  isValidPhone,
  truncate,
  capitalize,
  searchFilter,
} from '@/lib/utils';

describe('Utility Functions', () => {
  // ──────────────────────────────────────────
  // Currency Formatting
  // ──────────────────────────────────────────

  describe('formatCurrency', () => {
    it('should format JMD correctly', () => {
      const result = formatCurrency(1500, 'JMD');
      expect(result).toContain('1,500');
      expect(result).toContain('.00');
    });

    it('should format USD correctly', () => {
      const result = formatCurrency(1500.50, 'USD');
      expect(result).toContain('1,500');
      expect(result).toContain('.50');
    });

    it('should default to JMD when no currency specified', () => {
      const result = formatCurrency(100);
      // Should have dollar sign and formatting
      expect(result).toContain('100');
      expect(result).toContain('.00');
    });

    it('should handle zero', () => {
      const result = formatCurrency(0, 'JMD');
      expect(result).toContain('0.00');
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-500, 'JMD');
      expect(result).toContain('500');
    });

    it('should handle large amounts', () => {
      const result = formatCurrency(1_000_000, 'JMD');
      expect(result).toContain('1,000,000');
    });

    it('should handle fractional amounts', () => {
      const result = formatCurrency(1234.56, 'USD');
      expect(result).toContain('1,234.56');
    });

    it('should handle unknown currency codes gracefully', () => {
      // Should not throw, uses en-US fallback
      const result = formatCurrency(100, 'XYZ');
      expect(result).toContain('100');
    });
  });

  describe('formatJMD (deprecated)', () => {
    it('should format as JMD', () => {
      const result = formatJMD(1500);
      expect(result).toContain('1,500');
    });
  });

  describe('formatUSD (deprecated)', () => {
    it('should format as USD', () => {
      const result = formatUSD(1500);
      expect(result).toContain('1,500');
    });
  });

  describe('formatNumber', () => {
    it('should format with thousand separators', () => {
      expect(formatNumber(1234567)).toContain('1,234,567');
    });
  });

  describe('formatPercent', () => {
    it('should convert decimal to percentage string', () => {
      expect(formatPercent(0.15)).toBe('15.0%');
      expect(formatPercent(0.255)).toBe('25.5%');
      expect(formatPercent(1)).toBe('100.0%');
      expect(formatPercent(0)).toBe('0.0%');
    });
  });

  // ──────────────────────────────────────────
  // Date Formatting
  // ──────────────────────────────────────────

  describe('formatDate', () => {
    it('should format a Date object', () => {
      // Use explicit UTC noon to avoid timezone-shift issues
      const date = new Date('2026-01-15T12:00:00');
      const result = formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('2026');
      expect(result).toContain('15');
    });

    it('should format a date string', () => {
      const result = formatDate('2026-06-30');
      expect(result).toContain('Jun');
      expect(result).toContain('2026');
    });
  });

  describe('formatRelativeTime', () => {
    it('should show "Just now" for very recent times', () => {
      const result = formatRelativeTime(new Date());
      expect(result).toBe('Just now');
    });

    it('should show minutes for recent times', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatRelativeTime(fiveMinAgo);
      expect(result).toBe('5m ago');
    });

    it('should show hours for today', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const result = formatRelativeTime(threeHoursAgo);
      expect(result).toBe('3h ago');
    });

    it('should show days for this week', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoDaysAgo);
      expect(result).toBe('2d ago');
    });

    it('should show formatted date for older dates', () => {
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(oldDate);
      // Should be a formatted date, not relative
      expect(result).not.toContain('ago');
    });
  });

  // ──────────────────────────────────────────
  // GCT (General Consumption Tax) — Jamaica
  // ──────────────────────────────────────────

  describe('GCT Calculations', () => {
    it('should have correct GCT rates', () => {
      expect(GCT_RATES.standard).toBe(0.15);
      expect(GCT_RATES.telecom).toBe(0.25);
      expect(GCT_RATES.tourism).toBe(0.10);
      expect(GCT_RATES.zero_rated).toBe(0);
      expect(GCT_RATES.exempt).toBe(0);
    });

    it('getGCTRate should return correct rate', () => {
      expect(getGCTRate('standard')).toBe(0.15);
      expect(getGCTRate('telecom')).toBe(0.25);
    });

    it('calculateGCT should compute tax amount', () => {
      expect(calculateGCT(1000, 'standard')).toBe(150);
      expect(calculateGCT(1000, 'telecom')).toBe(250);
      expect(calculateGCT(1000, 'zero_rated')).toBe(0);
    });

    it('calculateTotalWithGCT should compute total', () => {
      expect(calculateTotalWithGCT(1000, 'standard')).toBe(1150);
      expect(calculateTotalWithGCT(1000, 'telecom')).toBe(1250);
      expect(calculateTotalWithGCT(1000, 'exempt')).toBe(1000);
    });

    it('should handle decimal amounts correctly', () => {
      const gct = calculateGCT(1234.56, 'standard');
      expect(gct).toBeCloseTo(185.184, 2);
    });
  });

  // ──────────────────────────────────────────
  // Invoice Status
  // ──────────────────────────────────────────

  describe('Invoice status helpers', () => {
    it('getInvoiceStatusColor should return correct colors', () => {
      expect(getInvoiceStatusColor('paid')).toBe('green');
      expect(getInvoiceStatusColor('partial')).toBe('yellow');
      expect(getInvoiceStatusColor('sent')).toBe('yellow');
      expect(getInvoiceStatusColor('overdue')).toBe('red');
      expect(getInvoiceStatusColor('draft')).toBe('gray');
      expect(getInvoiceStatusColor('cancelled')).toBe('gray');
      expect(getInvoiceStatusColor('unknown')).toBe('blue');
    });

    it('should be case-insensitive', () => {
      expect(getInvoiceStatusColor('PAID')).toBe('green');
      expect(getInvoiceStatusColor('Overdue')).toBe('red');
    });

    it('getInvoiceStatusLabel should return labels', () => {
      expect(getInvoiceStatusLabel('paid')).toBe('Paid');
      expect(getInvoiceStatusLabel('draft')).toBe('Draft');
      expect(getInvoiceStatusLabel('overdue')).toBe('Overdue');
    });

    it('should return raw status for unknown statuses', () => {
      expect(getInvoiceStatusLabel('custom_status')).toBe('custom_status');
    });
  });

  // ──────────────────────────────────────────
  // Category & Payment Labels
  // ──────────────────────────────────────────

  describe('getExpenseCategoryLabel', () => {
    it('should return friendly labels', () => {
      expect(getExpenseCategoryLabel('bank_fees')).toBe('Bank Fees');
      expect(getExpenseCategoryLabel('office_supplies')).toBe('Office Supplies');
      expect(getExpenseCategoryLabel('professional_services')).toBe('Professional Services');
    });

    it('should return raw value for unknown categories', () => {
      expect(getExpenseCategoryLabel('custom_cat')).toBe('custom_cat');
    });
  });

  describe('getPaymentMethodLabel', () => {
    it('should return friendly labels for Jamaica-specific methods', () => {
      expect(getPaymentMethodLabel('jam_dex')).toBe('JAM-DEX');
      expect(getPaymentMethodLabel('lynk_wallet')).toBe('Lynk Wallet');
      expect(getPaymentMethodLabel('wipay')).toBe('WiPay');
    });

    it('should return labels for standard methods', () => {
      expect(getPaymentMethodLabel('cash')).toBe('Cash');
      expect(getPaymentMethodLabel('bank_transfer')).toBe('Bank Transfer');
      expect(getPaymentMethodLabel('cheque')).toBe('Cheque');
    });
  });

  // ──────────────────────────────────────────
  // Address Formatting
  // ──────────────────────────────────────────

  describe('formatAddress', () => {
    it('should format a full address', () => {
      const result = formatAddress({
        street: '12 Main St',
        city: 'Kingston',
        parish: 'Kingston',
        country: 'Jamaica',
        postalCode: 'KGN',
      });
      expect(result).toBe('12 Main St, Kingston, Kingston, KGN, Jamaica');
    });

    it('should skip empty fields', () => {
      const result = formatAddress({
        street: '5 Hope Road',
        city: 'Kingston',
      });
      expect(result).toBe('5 Hope Road, Kingston');
    });

    it('should return empty string for null', () => {
      expect(formatAddress(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatAddress(undefined)).toBe('');
    });

    it('should return empty string for empty object', () => {
      expect(formatAddress({})).toBe('');
    });
  });

  // ──────────────────────────────────────────
  // Jamaica-Specific Validation
  // ──────────────────────────────────────────

  describe('isValidTRN (Jamaica Tax Registration Number)', () => {
    it('should accept 9-digit TRN', () => {
      expect(isValidTRN('123456789')).toBe(true);
    });

    it('should accept formatted TRN with dashes', () => {
      expect(isValidTRN('123-456-789')).toBe(true);
    });

    it('should reject too short', () => {
      expect(isValidTRN('12345678')).toBe(false);
    });

    it('should reject too long', () => {
      expect(isValidTRN('1234567890')).toBe(false);
    });
  });

  describe('isValidNIS', () => {
    it('should accept valid NIS numbers', () => {
      expect(isValidNIS('AB12345')).toBe(true);
      expect(isValidNIS('123456')).toBe(true);
    });

    it('should reject too short', () => {
      expect(isValidNIS('12345')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should accept valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user@yaadbooks.com')).toBe(true);
      expect(isValidEmail('name+tag@domain.co.jm')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@no-local')).toBe(false);
      expect(isValidEmail('no-domain@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidPhone (Jamaica)', () => {
    it('should accept Jamaica phone formats', () => {
      expect(isValidPhone('8761234567')).toBe(true);
      expect(isValidPhone('+18761234567')).toBe(true);
      expect(isValidPhone('876-123-4567')).toBe(true);
      expect(isValidPhone('1234567')).toBe(true);
    });

    it('should reject too short', () => {
      expect(isValidPhone('123456')).toBe(false);
    });
  });

  // ──────────────────────────────────────────
  // String Utilities
  // ──────────────────────────────────────────

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World!', 5)).toBe('Hello...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Hi', 10)).toBe('Hi');
    });

    it('should handle exact length', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should lowercase the rest', () => {
      expect(capitalize('hELLO')).toBe('Hello');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  // ──────────────────────────────────────────
  // Search/Filter
  // ──────────────────────────────────────────

  describe('searchFilter', () => {
    const items = [
      { name: 'John Smith', email: 'john@test.com', age: 30 },
      { name: 'Jane Doe', email: 'jane@example.com', age: 25 },
      { name: 'Bob Johnson', email: 'bob@test.com', age: 40 },
    ];

    it('should filter by string field', () => {
      const result = searchFilter(items, 'John', ['name']);
      expect(result).toHaveLength(2); // John Smith, Bob Johnson
    });

    it('should be case-insensitive', () => {
      const result = searchFilter(items, 'john', ['name']);
      expect(result).toHaveLength(2);
    });

    it('should search across multiple fields', () => {
      const result = searchFilter(items, 'test.com', ['name', 'email']);
      expect(result).toHaveLength(2); // john@test.com, bob@test.com
    });

    it('should search number fields', () => {
      const result = searchFilter(items, '30', ['age']);
      expect(result).toHaveLength(1);
    });

    it('should return all items for empty query', () => {
      const result = searchFilter(items, '', ['name']);
      expect(result).toHaveLength(3);
    });

    it('should return empty for no matches', () => {
      const result = searchFilter(items, 'xyz', ['name', 'email']);
      expect(result).toHaveLength(0);
    });
  });
});
