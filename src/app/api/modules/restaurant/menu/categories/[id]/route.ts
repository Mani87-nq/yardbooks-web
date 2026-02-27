/**
 * PUT/DELETE /api/modules/restaurant/menu/categories/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const existing = await (prisma as any).menuCategory.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Category not found');

    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const category = await (prisma as any).menuCategory.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(category);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update category');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr2 } = await requireModule(companyId!, 'restaurant');
    if (modErr2) return modErr2;

    const existing = await (prisma as any).menuCategory.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Category not found');

    // Soft-delete category and its items
    await (prisma as any).menuCategory.update({
      where: { id },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete category');
  }
}
