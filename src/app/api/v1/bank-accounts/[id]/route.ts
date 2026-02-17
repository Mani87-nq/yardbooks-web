/**
 * GET/PUT/DELETE /api/v1/bank-accounts/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'banking:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const account = await prisma.bankAccount.findFirst({
      where: { id, companyId: companyId! },
      include: { transactions: { take: 20, orderBy: { transactionDate: 'desc' } } },
    });
    if (!account) return notFound('Bank account not found');
    return NextResponse.json(account);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get bank account');
  }
}

const updateBankAccountSchema = z.object({
  accountName: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
  currentBalance: z.number().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'banking:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.bankAccount.findFirst({ where: { id, companyId: companyId! } });
    if (!existing) return notFound('Bank account not found');

    const body = await request.json();
    const parsed = updateBankAccountSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const account = await prisma.bankAccount.update({ where: { id }, data: parsed.data });
    return NextResponse.json(account);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update bank account');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'banking:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.bankAccount.findFirst({ where: { id, companyId: companyId! } });
    if (!existing) return notFound('Bank account not found');

    await prisma.bankAccount.update({ where: { id }, data: { isActive: false } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete bank account');
  }
}
