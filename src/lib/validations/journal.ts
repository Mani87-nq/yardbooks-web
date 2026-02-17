import { z } from 'zod/v4';
import { currencyAmountSchema } from './common';

export const journalLineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  description: z.string().max(500).optional(),
  debit: currencyAmountSchema.default(0),
  credit: currencyAmountSchema.default(0),
}).refine(
  (data) => (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0),
  { message: 'Each line must have either a debit or credit, not both' }
);

export const createJournalEntrySchema = z.object({
  date: z.coerce.date(),
  reference: z.string().max(100).optional(),
  description: z.string().min(1, 'Description is required').max(500),
  lines: z.array(journalLineSchema).min(2, 'At least two lines are required'),
}).refine(
  (data) => {
    const totalDebits = data.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = data.lines.reduce((sum, l) => sum + l.credit, 0);
    return Math.abs(totalDebits - totalCredits) < 0.01;
  },
  { message: 'Total debits must equal total credits' }
);

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
