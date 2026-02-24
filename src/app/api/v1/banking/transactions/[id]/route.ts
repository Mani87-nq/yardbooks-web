/**
 * GET/PUT/DELETE /api/v1/banking/transactions/[id]
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

    const transaction = await prisma.bankTransaction.findFirst({
      where: { id, bankAccount: { companyId: companyId! } },
    });
    if (!transaction) return notFound('Bank transaction not found');
    return NextResponse.json(transaction);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get bank transaction');
  }
}

const updateBankTransactionSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  reference: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  isReconciled: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'banking:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.bankTransaction.findFirst({
      where: { id, bankAccount: { companyId: companyId! } },
    });
    if (!existing) return notFound('Bank transaction not found');

    const body = await request.json();
    const parsed = updateBankTransactionSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const transaction = await prisma.bankTransaction.update({ where: { id }, data: parsed.data });
    return NextResponse.json(transaction);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update bank transaction');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'banking:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.bankTransaction.findFirst({
      where: { id, bankAccount: { companyId: companyId! } },
    });
    if (!existing) return notFound('Bank transaction not found');

    await prisma.bankTransaction.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete bank transaction');
  }
}
