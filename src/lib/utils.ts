// YaadBooks Web - Utility Functions
import { clsx, type ClassValue } from 'clsx';

// ============================================
// CLASSNAME UTILITY
// ============================================

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// ============================================
// CURRENCY FORMATTING
// ============================================

export function formatJMD(amount: number): string {
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrency(amount: number, currency: 'JMD' | 'USD' = 'JMD'): string {
  return currency === 'JMD' ? formatJMD(amount) : formatUSD(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-JM').format(num);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ============================================
// DATE FORMATTING
// ============================================

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-JM', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-JM', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-JM', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

// ============================================
// GCT CALCULATIONS
// ============================================

export const GCT_RATES = {
  standard: 0.15,
  telecom: 0.25,
  tourism: 0.10,
  zero_rated: 0,
  exempt: 0,
} as const;

export function getGCTRate(rate: keyof typeof GCT_RATES): number {
  return GCT_RATES[rate];
}

export function calculateGCT(amount: number, rate: keyof typeof GCT_RATES): number {
  return amount * GCT_RATES[rate];
}

export function calculateTotalWithGCT(amount: number, rate: keyof typeof GCT_RATES): number {
  return amount * (1 + GCT_RATES[rate]);
}

// ============================================
// INVOICE STATUS
// ============================================

export type InvoiceStatusColor = 'green' | 'yellow' | 'red' | 'gray' | 'blue';

export function getInvoiceStatusColor(status: string): InvoiceStatusColor {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'green';
    case 'partial':
    case 'sent':
    case 'viewed':
      return 'yellow';
    case 'overdue':
      return 'red';
    case 'draft':
      return 'gray';
    case 'cancelled':
      return 'gray';
    default:
      return 'blue';
  }
}

export function getInvoiceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    viewed: 'Viewed',
    partial: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
  };
  return labels[status.toLowerCase()] || status;
}

// ============================================
// EXPENSE CATEGORIES
// ============================================

export function getExpenseCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    advertising: 'Advertising',
    bank_fees: 'Bank Fees',
    contractor: 'Contractor',
    equipment: 'Equipment',
    insurance: 'Insurance',
    inventory: 'Inventory',
    meals: 'Meals',
    office_supplies: 'Office Supplies',
    professional_services: 'Professional Services',
    rent: 'Rent',
    repairs: 'Repairs',
    salaries: 'Salaries',
    software: 'Software',
    taxes: 'Taxes',
    telephone: 'Telephone',
    travel: 'Travel',
    utilities: 'Utilities',
    vehicle: 'Vehicle',
    other: 'Other',
  };
  return labels[category] || category;
}

// ============================================
// PAYMENT METHODS
// ============================================

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    jam_dex: 'JAM-DEX',
    lynk_wallet: 'Lynk Wallet',
    wipay: 'WiPay',
    card_visa: 'Visa',
    card_mastercard: 'Mastercard',
    card_other: 'Card',
    bank_transfer: 'Bank Transfer',
    store_credit: 'Store Credit',
    cheque: 'Cheque',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    mobile_money: 'Mobile Money',
    other: 'Other',
  };
  return labels[method] || method;
}

// ============================================
// ADDRESS FORMATTING
// ============================================

export function formatAddress(address: {
  street?: string;
  city?: string;
  parish?: string;
  country?: string;
  postalCode?: string;
} | null | undefined): string {
  if (!address) return '';
  const parts = [
    address.street,
    address.city,
    address.parish,
    address.postalCode,
    address.country,
  ].filter(Boolean);
  return parts.join(', ');
}

// ============================================
// JAMAICAN PARISHES
// ============================================

export const JAMAICAN_PARISHES = [
  'Kingston',
  'St. Andrew',
  'St. Thomas',
  'Portland',
  'St. Mary',
  'St. Ann',
  'Trelawny',
  'St. James',
  'Hanover',
  'Westmoreland',
  'St. Elizabeth',
  'Manchester',
  'Clarendon',
  'St. Catherine',
] as const;

// ============================================
// VALIDATION
// ============================================

export function isValidTRN(trn: string): boolean {
  // Jamaica TRN format: 9 digits
  const cleanTRN = trn.replace(/\D/g, '');
  return cleanTRN.length === 9;
}

export function isValidNIS(nis: string): boolean {
  // Jamaica NIS format: varies, but typically 6-7 digits with possible letters
  return nis.length >= 6 && nis.length <= 10;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  // Jamaica phone: +1876XXXXXXX or 876XXXXXXX or XXXXXXX
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 7 && cleanPhone.length <= 12;
}

// ============================================
// STRING UTILITIES
// ============================================

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================
// SEARCH/FILTER
// ============================================

export function searchFilter<T extends Record<string, unknown>>(
  items: T[],
  query: string,
  fields: (keyof T)[]
): T[] {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();
  return items.filter((item) =>
    fields.some((field) => {
      const value = item[field];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(lowerQuery);
      }
      if (typeof value === 'number') {
        return value.toString().includes(lowerQuery);
      }
      return false;
    })
  );
}
