/**
 * GET    /api/v1/customer-pos/[id] — Get customer PO with items + linked invoices
 * PUT    /api/v1/customer-pos/[id] — Update customer PO
 * DELETE /api/v1/customer-pos/[id] — Cancel customer PO
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { requireFeature } from '@/lib/plan-gate.server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { error: planError } = await requireFeature(request, 'customer_po');
    if (planError) return planError;

    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const customerPO = await prisma.customerPurchaseOrder.findFirst({
      where: { id, companyId: companyId! },
      include: {
        customer: true,
        items: { orderBy: { lineNumber: 'asc' } },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            issueDate: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!customerPO) return notFound('Customer purchase order not found');
    return NextResponse.json(customerPO);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get customer purchase order');
  }
}

const updateCustomerPOSchema = z.object({
  internalReference: z.string().max(100).optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'CANCELLED']).optional(),
  requestedDeliveryDate: z.coerce.date().optional(),
  customerReference: z.string().max(200).optional(),
  shippingStreet: z.string().max(500).optional(),
  shippingCity: z.string().max(200).optional(),
  shippingParish: z.enum([
    'KINGSTON', 'ST_ANDREW', 'ST_THOMAS', 'PORTLAND', 'ST_MARY', 'ST_ANN',
    'TRELAWNY', 'ST_JAMES', 'HANOVER', 'WESTMORELAND', 'ST_ELIZABETH',
    'MANCHESTER', 'CLARENDON', 'ST_CATHERINE',
  ]).optional(),
  shippingCountry: z.string().max(100).optional(),
  shippingPostal: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { error: planError } = await requireFeature(request, 'customer_po');
    if (planError) return planError;

    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.customerPurchaseOrder.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Customer purchase order not found');

    // Cannot update cancelled or fully invoiced POs
    if (['CANCELLED', 'FULLY_INVOICED'].includes(existing.status)) {
      return badRequest('Cannot update a customer PO that is cancelled or fully invoiced');
    }

    const body = await request.json();
    const parsed = updateCustomerPOSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const customerPO = await prisma.customerPurchaseOrder.update({
      where: { id },
      data: parsed.data,
      include: {
        items: { orderBy: { lineNumber: 'asc' } },
        customer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(customerPO);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update customer purchase order');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { error: planError } = await requireFeature(request, 'customer_po');
    if (planError) return planError;

    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.customerPurchaseOrder.findFirst({
      where: { id, companyId: companyId! },
      include: { invoices: { select: { id: true } } },
    });
    if (!existing) return notFound('Customer purchase order not found');

    // Cannot cancel if already cancelled
    if (existing.status === 'CANCELLED') {
      return badRequest('Customer PO is already cancelled');
    }

    // Warn if there are linked invoices
    if (existing.invoices.length > 0 && existing.status !== 'DRAFT') {
      return badRequest(
        'Cannot cancel a customer PO that has linked invoices. Close it instead.',
      );
    }

    const customerPO = await prisma.customerPurchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        items: true,
        customer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(customerPO);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to cancel customer purchase order');
  }
}
