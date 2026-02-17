/**
 * GET/PUT/DELETE /api/v1/recurring-invoices/[id]
 * Manage a specific recurring invoice template.
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
    const { user, error: authError } = await requirePermission(request, 'invoices:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const template = await prisma.recurringInvoice.findFirst({
      where: { id, companyId: companyId! },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!template) return notFound('Recurring invoice not found');
    return NextResponse.json(template);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get recurring invoice');
  }
}

const updateSchema = z.object({
  description: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  endDate: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Recurring invoice not found');

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const updated = await prisma.recurringInvoice.update({
      where: { id },
      data: parsed.data,
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update recurring invoice');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Recurring invoice not found');

    // Soft deactivate rather than hard delete
    await prisma.recurringInvoice.update({
      where: { id },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete recurring invoice');
  }
}
