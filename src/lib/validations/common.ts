/**
 * Common Zod validation schemas shared across modules.
 */
import { z } from 'zod/v4';

// ============================================
// BASIC FIELD VALIDATORS
// ============================================

export const emailSchema = z.email('Invalid email address');

export const phoneSchema = z
  .string()
  .regex(/^[\d+\-() ]{7,15}$/, 'Invalid phone number');

export const trnSchema = z
  .string()
  .regex(/^\d{9}$/, 'TRN must be exactly 9 digits');

export const nisSchema = z
  .string()
  .min(6, 'NIS must be at least 6 characters')
  .max(10, 'NIS must be at most 10 characters');

export const currencyAmountSchema = z
  .number()
  .min(0, 'Amount must be non-negative')
  .finite('Amount must be a finite number');

export const positiveAmountSchema = z
  .number()
  .positive('Amount must be greater than zero')
  .finite('Amount must be a finite number');

export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage must be at most 100');

export const currencyCodeSchema = z.enum(['JMD', 'USD']);

export const gctRateSchema = z.enum([
  'standard',
  'telecom',
  'tourism',
  'zero_rated',
  'exempt',
]);

export const jamaicaParishSchema = z.enum([
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
]);

export const addressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  parish: jamaicaParishSchema,
  country: z.string().default('Jamaica'),
  postalCode: z.string().optional(),
});

export const paymentMethodSchema = z.enum([
  'cash',
  'jam_dex',
  'lynk_wallet',
  'wipay',
  'card_visa',
  'card_mastercard',
  'card_other',
  'bank_transfer',
  'store_credit',
  'cheque',
  'credit_card',
  'debit_card',
  'mobile_money',
  'other',
]);

// ============================================
// PAGINATION
// ============================================

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// ============================================
// DATE RANGE
// ============================================

export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be after start date' }
);
