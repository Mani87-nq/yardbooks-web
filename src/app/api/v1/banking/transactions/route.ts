/**
 * GET/POST /api/v1/banking/transactions
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'banking:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get('bankAccountId') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: { companyId: companyId! },
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      orderBy: { transactionDate: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: transactions });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list bank transactions');
  }
}

const createBankTransactionSchema = z.object({
  bankAccountId: z.string().min(1),
  transactionDate: z.coerce.date(),
  postDate: z.coerce.date().optional(),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional(),
  amount: z.number(),
  balance: z.number().optional(),
  category: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'banking:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createBankTransactionSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Verify bank account belongs to company
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: parsed.data.bankAccountId, companyId: companyId! },
    });
    if (!bankAccount) return badRequest('Bank account not found');

    const transaction = await prisma.bankTransaction.create({
      data: {
        bankAccountId: parsed.data.bankAccountId,
        transactionDate: parsed.data.transactionDate,
        postDate: parsed.data.postDate ?? parsed.data.transactionDate,
        description: parsed.data.description,
        reference: parsed.data.reference ?? null,
        amount: parsed.data.amount,
        balance: parsed.data.balance ?? null,
        category: parsed.data.category ?? null,
        isReconciled: false,
      },
    });

    // Update bank account balance
    await prisma.bankAccount.update({
      where: { id: parsed.data.bankAccountId },
      data: {
        currentBalance: { increment: parsed.data.amount },
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create bank transaction');
  }
}
