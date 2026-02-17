import { z } from 'zod/v4';
import { currencyAmountSchema, paymentMethodSchema } from './common';

export const expenseCategorySchema = z.enum([
  'advertising',
  'bank_fees',
  'contractor',
  'equipment',
  'insurance',
  'inventory',
  'meals',
  'office_supplies',
  'professional_services',
  'rent',
  'repairs',
  'salaries',
  'software',
  'taxes',
  'telephone',
  'travel',
  'utilities',
  'vehicle',
  'other',
]);

export const createExpenseSchema = z.object({
  vendorId: z.string().optional(),
  category: expenseCategorySchema,
  description: z.string().min(1, 'Description is required').max(500),
  amount: currencyAmountSchema.refine((v) => v > 0, 'Amount must be greater than 0'),
  gctAmount: currencyAmountSchema.default(0),
  gctClaimable: z.boolean().default(false),
  date: z.coerce.date(),
  paymentMethod: paymentMethodSchema,
  reference: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  isRecurring: z.boolean().default(false),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
