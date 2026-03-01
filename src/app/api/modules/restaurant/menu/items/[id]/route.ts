/**
 * GET/PUT/DELETE /api/modules/restaurant/menu/items/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

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
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0).optional(),
  imageUrl: z.string().url().nullable().optional(),
  prepTime: z.number().int().min(0).nullable().optional(),
  preparationTime: z.number().int().min(0).nullable().optional(),
  allergens: z.string().max(500).nullable().optional(),
  modifiers: z.string().max(500).nullable().optional(),
  isAvailable: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  tags: z.array(z.string()).nullable().optional(),
  course: z.enum(['APPETIZER', 'MAIN', 'DESSERT', 'DRINK', 'SIDE']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  productId: z.string().nullable().optional(),
}).passthrough(); // Allow extra UI fields (id, category, createdAt, etc.) without failing validation

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const existing = await (prisma as any).menuItem.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Menu item not found');

    const body = await request.json();
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    // Resolve aliased fields and build clean DB update payload
    const prepTime = parsed.data.prepTime ?? parsed.data.preparationTime;
    const updateData: Record<string, any> = {};
    if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId;
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.price !== undefined) updateData.price = parsed.data.price;
    if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl;
    if (prepTime !== undefined) updateData.prepTime = prepTime;
    if (parsed.data.isAvailable !== undefined) updateData.isAvailable = parsed.data.isAvailable;
    if (parsed.data.isPopular !== undefined) updateData.isPopular = parsed.data.isPopular;
    if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
    if (parsed.data.course !== undefined) updateData.course = parsed.data.course;
    if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
    if (parsed.data.productId !== undefined) updateData.productId = parsed.data.productId;

    const item = await (prisma as any).menuItem.update({
      where: { id },
      data: updateData,
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
    const { error: modErr3 } = await requireModule(companyId!, 'restaurant');
    if (modErr3) return modErr3;

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
