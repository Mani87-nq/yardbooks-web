/**
 * GET    /api/v1/products/[id]
 * PUT    /api/v1/products/[id]
 * DELETE /api/v1/products/[id]
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
    const { user, error: authError } = await requirePermission(request, 'products:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const product = await prisma.product.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
    });
    if (!product) return notFound('Product not found');
    return NextResponse.json(product);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get product');
  }
}

const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  unitPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  taxable: z.boolean().optional(),
  gctRate: z.enum(['STANDARD', 'TELECOM', 'TOURISM', 'ZERO_RATED', 'EXEMPT']).optional(),
  isActive: z.boolean().optional(),
  barcode: z.string().max(50).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'products:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.product.findFirst({ where: { id, companyId: companyId!, deletedAt: null } });
    if (!existing) return notFound('Product not found');

    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const product = await prisma.product.update({ where: { id, companyId: companyId! }, data: parsed.data });
    return NextResponse.json(product);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update product');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'products:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.product.findFirst({ where: { id, companyId: companyId!, deletedAt: null } });
    if (!existing) return notFound('Product not found');

    await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete product');
  }
}
