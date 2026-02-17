import { z } from 'zod/v4';
import { currencyAmountSchema, gctRateSchema } from './common';

export const productUnitSchema = z.enum([
  'each', 'box', 'case', 'dozen',
  'kg', 'lb', 'litre', 'gallon',
  'metre', 'foot', 'hour', 'day',
]);

export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  name: z.string().min(1, 'Product name is required').max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  unitPrice: currencyAmountSchema,
  costPrice: currencyAmountSchema,
  quantity: z.number().int().min(0, 'Quantity cannot be negative').default(0),
  reorderLevel: z.number().int().min(0).default(0),
  unit: productUnitSchema.default('each'),
  taxable: z.boolean().default(true),
  gctRate: gctRateSchema.default('standard'),
  barcode: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
