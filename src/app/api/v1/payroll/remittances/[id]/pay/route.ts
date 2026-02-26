/**
 * POST /api/v1/payroll/remittances/[id]/pay — Mark a remittance as paid
 *
 * Records payment of statutory deductions to government agency.
 * Posts a GL journal entry: DR liability (PAYE/NIS/NHT Payable) → CR Cash/Bank.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { postJournalEntry } from '@/lib/accounting/engine';

type RouteContext = { params: Promise<{ id: string }> };

// Map remittance types to GL liability accounts
const LIABILITY_ACCOUNTS: Record<string, string> = {
  PAYE: '2200',           // PAYE Payable
  NIS: '2210',            // NIS Payable (Employee) — combined
  NHT: '2220',            // NHT Payable (Employee) — combined
  EDUCATION_TAX: '2230',  // Education Tax Payable (Employee) — combined
  HEART_NTA: '2240',      // HEART/NTA Payable
};

// NIS/NHT/EdTax have both employee and employer liability accounts
const EMPLOYER_LIABILITY_ACCOUNTS: Record<string, string> = {
  NIS: '2310',            // NIS Payable (Employer)
  NHT: '2320',            // NHT Payable (Employer)
  EDUCATION_TAX: '2330',  // Education Tax Payable (Employer)
};

const paySchema = z.object({
  paymentDate: z.coerce.date(),
  referenceNumber: z.string().max(100).optional(),
  bankAccountCode: z.string().max(20).default('1020'), // Default: Bank Account
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:approve');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { id } = await context.params;

    const body = await request.json();
    const parsed = paySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid payment data');
    }

    // Look up the remittance
    const remittance = await prisma.statutoryRemittance.findFirst({
      where: { id, companyId: companyId! },
    });

    if (!remittance) {
      return notFound('Remittance not found');
    }

    if (remittance.status === 'PAID') {
      return badRequest('This remittance has already been paid');
    }

    const paymentAmount = Number(remittance.amountDue) - Number(remittance.amountPaid);
    if (paymentAmount <= 0) {
      return badRequest('No outstanding amount on this remittance');
    }

    // Build GL journal entry lines
    const liabilityAccount = LIABILITY_ACCOUNTS[remittance.remittanceType];
    const employerLiabilityAccount = EMPLOYER_LIABILITY_ACCOUNTS[remittance.remittanceType];

    const debitLines: Array<{ accountNumber: string; debitAmount: number; creditAmount: number; description: string }> = [];

    if (liabilityAccount) {
      if (employerLiabilityAccount) {
        // Debit the combined liability from the employee account
        debitLines.push({
          accountNumber: liabilityAccount,
          debitAmount: paymentAmount,
          creditAmount: 0,
          description: `${remittance.remittanceType} remittance payment (employee portion)`,
        });
      } else {
        debitLines.push({
          accountNumber: liabilityAccount,
          debitAmount: paymentAmount,
          creditAmount: 0,
          description: `${remittance.remittanceType} remittance payment`,
        });
      }
    }

    // Post GL journal entry
    const periodDate = new Date(remittance.periodMonth);
    const monthStr = periodDate.toLocaleDateString('en-JM', { year: 'numeric', month: 'long' });

    const jeResult = await postJournalEntry({
      companyId: companyId!,
      userId: user!.sub,
      date: parsed.data.paymentDate,
      reference: `REM-${remittance.remittanceType}-${monthStr}`,
      description: `Statutory ${remittance.remittanceType} remittance for ${monthStr}`,
      sourceModule: 'REMITTANCE',
      sourceDocumentId: id,
      lines: [
        // Debit: Liability account (reduce what we owe)
        ...debitLines,
        // Credit: Bank account (cash goes out)
        {
          accountNumber: parsed.data.bankAccountCode,
          debitAmount: 0,
          creditAmount: paymentAmount,
          description: `Payment of ${remittance.remittanceType} to government`,
        },
      ],
    });

    // Update remittance record
    const updated = await prisma.statutoryRemittance.update({
      where: { id },
      data: {
        amountPaid: Number(remittance.amountPaid) + paymentAmount,
        paymentDate: parsed.data.paymentDate,
        referenceNumber: parsed.data.referenceNumber,
        status: 'PAID',
        journalEntryId: jeResult.journalEntryId ?? undefined,
        notes: parsed.data.notes,
      },
    });

    return NextResponse.json({
      remittance: updated,
      journalEntryId: jeResult.journalEntryId,
      paymentAmount,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to process remittance payment');
  }
}
