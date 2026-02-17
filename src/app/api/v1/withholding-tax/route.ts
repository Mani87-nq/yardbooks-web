/**
 * GET/POST /api/v1/withholding-tax
 * Withholding Tax management.
 * Jamaica WHT rates:
 * - Dividends: 15%
 * - Interest: 25%
 * - Royalties: 25%
 * - Management fees: 25%
 * - Contractors Levy: 2%
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

const WHT_RATES: Record<string, number> = {
  DIVIDENDS: 0.15,
  INTEREST: 0.25,
  ROYALTIES: 0.25,
  MANAGEMENT_FEES: 0.25,
  CONTRACTORS_LEVY: 0.02,
};

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'tax:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const isRemitted = searchParams.get('isRemitted');

    const where: Record<string, unknown> = { companyId: companyId! };
    if (vendorId) where.vendorId = vendorId;
    if (isRemitted !== null && isRemitted !== undefined) {
      where.isRemitted = isRemitted === 'true';
    }
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.paymentDate = dateFilter;
    }

    const transactions = await prisma.withholdingTaxTransaction.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true, trnNumber: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    // Monthly remittance summary
    const unremittedTotal = transactions
      .filter((t) => !t.isRemitted)
      .reduce((sum, t) => sum + Number(t.taxAmount), 0);

    return NextResponse.json({
      data: transactions,
      summary: {
        count: transactions.length,
        totalTaxWithheld: round2(transactions.reduce((s, t) => s + Number(t.taxAmount), 0)),
        unremittedTotal: round2(unremittedTotal),
      },
      rates: WHT_RATES,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list WHT transactions');
  }
}

const createWHTSchema = z.object({
  vendorId: z.string().min(1),
  paymentDate: z.coerce.date(),
  paymentAmount: z.number().positive(),
  taxType: z.enum(['DIVIDENDS', 'INTEREST', 'ROYALTIES', 'MANAGEMENT_FEES', 'CONTRACTORS_LEVY']),
  description: z.string().optional(),
  reference: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'tax:export');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createWHTSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { vendorId, paymentDate, paymentAmount, taxType, description, reference } = parsed.data;
    const taxRate = WHT_RATES[taxType];
    const taxAmount = round2(paymentAmount * taxRate);

    const transaction = await prisma.withholdingTaxTransaction.create({
      data: {
        companyId: companyId!,
        vendorId,
        paymentDate,
        paymentAmount,
        taxType,
        taxRate,
        taxAmount,
        description,
        reference,
        createdBy: user!.sub,
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create WHT transaction');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
