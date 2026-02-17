/**
 * GET    /api/v1/customers/[id] — Get a single customer
 * PUT    /api/v1/customers/[id] — Update a customer
 * DELETE /api/v1/customers/[id] — Soft-delete a customer
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

// ---- GET ----

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'customers:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const customer = await prisma.customer.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      include: {
        invoices: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) return notFound('Customer not found');

    return NextResponse.json(customer);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get customer');
  }
}

// ---- PUT ----

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['CUSTOMER', 'VENDOR', 'BOTH']).optional(),
  companyName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  trnNumber: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'customers:update');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Ensure customer belongs to company
    const existing = await prisma.customer.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
    });
    if (!existing) return notFound('Customer not found');

    const body = await request.json();
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Validation failed');
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update customer');
  }
}

// ---- DELETE (soft) ----

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'customers:delete');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.customer.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
    });
    if (!existing) return notFound('Customer not found');

    await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete customer');
  }
}
