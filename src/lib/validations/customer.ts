import { z } from 'zod/v4';
import { addressSchema, emailSchema, phoneSchema, trnSchema } from './common';

export const createCustomerSchema = z.object({
  type: z.enum(['customer', 'vendor', 'both']).default('customer'),
  name: z.string().min(1, 'Name is required').max(200),
  companyName: z.string().max(200).optional(),
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema.optional().or(z.literal('')),
  address: addressSchema.optional(),
  trnNumber: trnSchema.optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
