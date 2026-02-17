/**
 * GET/PUT/DELETE /api/v1/quotations/[id]
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
    const { user, error: authError } = await requirePermission(request, 'quotations:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const quotation = await prisma.quotation.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      include: { customer: true, items: true },
    });
    if (!quotation) return notFound('Quotation not found');
    return NextResponse.json(quotation);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get quotation');
  }
}

const updateQuotationSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  validUntil: z.coerce.date().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'quotations:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.quotation.findFirst({ where: { id, companyId: companyId!, deletedAt: null } });
    if (!existing) return notFound('Quotation not found');

    const body = await request.json();
    const parsed = updateQuotationSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const quotation = await prisma.quotation.update({
      where: { id },
      data: parsed.data,
      include: { items: true, customer: { select: { id: true, name: true } } },
    });
    return NextResponse.json(quotation);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update quotation');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'quotations:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.quotation.findFirst({ where: { id, companyId: companyId!, deletedAt: null } });
    if (!existing) return notFound('Quotation not found');

    await prisma.quotation.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete quotation');
  }
}
