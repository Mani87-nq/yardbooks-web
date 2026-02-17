import { z } from 'zod/v4';
import { emailSchema, phoneSchema, trnSchema, nisSchema, currencyAmountSchema } from './common';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema.optional().or(z.literal('')),
  position: z.string().min(1, 'Position is required').max(100),
  department: z.string().max(100).optional(),
  employeeType: z.enum(['full_time', 'part_time', 'contract']).default('full_time'),
  payType: z.enum(['salary', 'hourly']).default('salary'),
  payRate: currencyAmountSchema.refine((v) => v > 0, 'Pay rate must be greater than 0'),
  trnNumber: trnSchema.optional().or(z.literal('')),
  nisNumber: nisSchema.optional().or(z.literal('')),
  startDate: z.coerce.date(),
  bankName: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankBranch: z.string().max(100).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const payrollRunSchema = z.object({
  payPeriodStart: z.coerce.date(),
  payPeriodEnd: z.coerce.date(),
  payDate: z.coerce.date(),
  employeeIds: z.array(z.string()).min(1, 'At least one employee is required'),
}).refine(
  (data) => data.payPeriodEnd >= data.payPeriodStart,
  { message: 'Pay period end must be after start' }
);

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type PayrollRunInput = z.infer<typeof payrollRunSchema>;
