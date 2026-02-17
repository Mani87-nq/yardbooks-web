/**
 * GET/POST /api/v1/bank-accounts
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

    const accounts = await prisma.bankAccount.findMany({
      where: { companyId: companyId!, isActive: true },
      orderBy: { accountName: 'asc' },
    });

    return NextResponse.json({ data: accounts });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list bank accounts');
  }
}

const createBankAccountSchema = z.object({
  accountName: z.string().min(1).max(200),
  bankName: z.string().min(1).max(200),
  accountNumber: z.string().min(1).max(50),
  accountType: z.enum(['CHECKING', 'SAVINGS', 'MONEY_MARKET', 'CREDIT_CARD', 'LOAN', 'OTHER']).default('CHECKING'),
  currency: z.enum(['JMD', 'USD']).default('JMD'),
  currentBalance: z.number().default(0),
  isActive: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'banking:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createBankAccountSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const account = await prisma.bankAccount.create({
      data: { ...parsed.data, companyId: companyId! },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create bank account');
  }
}
