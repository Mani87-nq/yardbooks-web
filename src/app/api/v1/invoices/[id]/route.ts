/**
 * GET    /api/v1/invoices/[id]
 * PUT    /api/v1/invoices/[id]
 * DELETE /api/v1/invoices/[id]
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

    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      include: {
        customer: true,
        items: true,
        payments: true,
      },
    });
    if (!invoice) return notFound('Invoice not found');
    return NextResponse.json(invoice);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get invoice');
  }
}

const updateInvoiceSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  dueDate: z.coerce.date().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.invoice.findFirst({ where: { id, companyId: companyId!, deletedAt: null } });
    if (!existing) return notFound('Invoice not found');

    const body = await request.json();
    const parsed = updateInvoiceSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const invoice = await prisma.invoice.update({
      where: { id },
      data: parsed.data,
      include: { items: true, customer: { select: { id: true, name: true } } },
    });
    return NextResponse.json(invoice);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update invoice');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.invoice.findFirst({ where: { id, companyId: companyId!, deletedAt: null } });
    if (!existing) return notFound('Invoice not found');

    // Only drafts can be deleted, others must be cancelled
    if (existing.status !== 'DRAFT') {
      return badRequest('Only draft invoices can be deleted. Cancel the invoice instead.');
    }

    await prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete invoice');
  }
}
