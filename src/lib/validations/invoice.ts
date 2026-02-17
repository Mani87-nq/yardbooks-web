import { z } from 'zod/v4';
import { currencyAmountSchema, gctRateSchema } from './common';

export const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: currencyAmountSchema,
  gctRate: gctRateSchema,
  gctAmount: currencyAmountSchema,
  total: currencyAmountSchema,
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  subtotal: currencyAmountSchema,
  gctAmount: currencyAmountSchema,
  discount: currencyAmountSchema.default(0),
  discountType: z.enum(['fixed', 'percentage']).default('fixed'),
  total: currencyAmountSchema,
  dueDate: z.coerce.date(),
  issueDate: z.coerce.date(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
