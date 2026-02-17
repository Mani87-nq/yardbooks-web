/**
 * GET/PUT/DELETE /api/v1/expenses/[id]
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
    const { user, error: authError } = await requirePermission(request, 'expenses:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const expense = await prisma.expense.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      include: { vendor: { select: { id: true, name: true } } },
    });
    if (!expense) return notFound('Expense not found');
    return NextResponse.json(expense);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get expense');
  }
}

const updateExpenseSchema = z.object({
  category: z.enum(['ADVERTISING', 'BANK_FEES', 'CONTRACTOR', 'EQUIPMENT', 'INSURANCE', 'INVENTORY', 'MEALS', 'OFFICE_SUPPLIES', 'PROFESSIONAL_SERVICES', 'RENT', 'REPAIRS', 'SALARIES', 'SOFTWARE', 'TAXES', 'TELEPHONE', 'TRAVEL', 'UTILITIES', 'VEHICLE', 'OTHER']).optional(),
  description: z.string().max(500).optional(),
  amount: z.number().positive().optional(),
  gctAmount: z.number().min(0).optional(),
  gctClaimable: z.boolean().optional(),
  date: z.coerce.date().optional(),
  paymentMethod: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY']).optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'expenses:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.expense.findFirst({ where: { id, companyId: companyId!, deletedAt: null } });
    if (!existing) return notFound('Expense not found');

    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const expense = await prisma.expense.update({ where: { id }, data: parsed.data });
    return NextResponse.json(expense);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update expense');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'expenses:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.expense.findFirst({ where: { id, companyId: companyId!, deletedAt: null } });
    if (!existing) return notFound('Expense not found');

    await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete expense');
  }
}
