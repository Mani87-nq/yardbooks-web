/**
 * GET/PUT/DELETE /api/modules/restaurant/menu/items/[id]
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
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const item = await (prisma as any).menuItem.findFirst({
      where: { id, companyId: companyId! },
      include: {
        category: { select: { id: true, name: true } },
        modifierGroups: {
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!item) return notFound('Menu item not found');

    return NextResponse.json(item);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get menu item');
  }
}

const updateItemSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  price: z.number().min(0).optional(),
  imageUrl: z.string().url().optional(),
  prepTime: z.number().int().min(0).optional(),
  isAvailable: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  course: z.enum(['APPETIZER', 'MAIN', 'DESSERT', 'DRINK', 'SIDE']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  productId: z.string().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await (prisma as any).menuItem.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Menu item not found');

    const body = await request.json();
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const item = await (prisma as any).menuItem.update({
      where: { id },
      data: parsed.data,
      include: {
        category: { select: { id: true, name: true } },
        modifierGroups: {
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update menu item');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await (prisma as any).menuItem.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Menu item not found');

    await (prisma as any).menuItem.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete menu item');
  }
}
