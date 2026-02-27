/**
 * POST /api/modules/restaurant/menu/items/[id]/modifiers — Manage modifier groups and modifiers
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const modifierSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

const modifierGroupSchema = z.object({
  name: z.string().min(1).max(100),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).default(0),
  modifiers: z.array(modifierSchema).min(1),
});

const requestSchema = z.object({
  groups: z.array(modifierGroupSchema),
  /** If true, replaces all existing modifier groups for this item */
  replaceAll: z.boolean().default(false),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: menuItemId } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const item = await (prisma as any).menuItem.findFirst({
      where: { id: menuItemId, companyId: companyId! },
    });
    if (!item) return notFound('Menu item not found');

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    await (prisma as any).$transaction(async (tx: any) => {
      // If replacing all, delete existing groups first
      if (parsed.data.replaceAll) {
        await tx.menuModifierGroup.deleteMany({
          where: { menuItemId, companyId: companyId! },
        });
      }

      // Create new modifier groups and their modifiers
      for (const group of parsed.data.groups) {
        await tx.menuModifierGroup.create({
          data: {
            companyId: companyId!,
            menuItemId,
            name: group.name,
            required: group.required,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder,
            modifiers: {
              create: group.modifiers.map((mod) => ({
                companyId: companyId!,
                name: mod.name,
                price: mod.price,
                isDefault: mod.isDefault,
                isAvailable: mod.isAvailable,
                sortOrder: mod.sortOrder,
              })),
            },
          },
        });
      }
    });

    // Return the updated item with all modifiers
    const updatedItem = await (prisma as any).menuItem.findFirst({
      where: { id: menuItemId },
      include: {
        category: { select: { id: true, name: true } },
        modifierGroups: {
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to manage modifiers');
  }
}
