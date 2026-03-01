/**
 * GET  /api/modules/restaurant/menu/items — List menu items
 * POST /api/modules/restaurant/menu/items — Create menu item
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const course = searchParams.get('course') ?? undefined;
    const available = searchParams.get('available');

    const where: any = {
      companyId: companyId!,
      ...(categoryId ? { categoryId } : {}),
      ...(course ? { course } : {}),
      ...(available !== null && available !== undefined ? { isAvailable: available === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const items = await (prisma as any).menuItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
        modifierGroups: {
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Transform to include UI-friendly field aliases
    const data = items.map((item: any) => ({
      ...item,
      price: Number(item.price),
      preparationTime: item.prepTime,
      allergens: Array.isArray(item.tags) ? item.tags.join(', ') : null,
      modifiers: item.modifierGroups?.map((g: any) => g.name).join(', ') || null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list menu items');
  }
}

const createItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0),
  imageUrl: z.string().url().nullable().optional(),
  // Accept both field names
  prepTime: z.number().int().min(0).nullable().optional(),
  preparationTime: z.number().int().min(0).nullable().optional(),
  allergens: z.string().max(500).nullable().optional(),
  modifiers: z.string().max(500).nullable().optional(),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  course: z.enum(['APPETIZER', 'MAIN', 'DESSERT', 'DRINK', 'SIDE']).default('MAIN'),
  sortOrder: z.number().int().min(0).default(0),
  productId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:menu:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const body = await request.json();
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Resolve aliased field names
    const prepTime = parsed.data.prepTime ?? parsed.data.preparationTime ?? null;

    // Build tags array that includes allergens info if provided
    let tags = parsed.data.tags || [];
    if (parsed.data.allergens) {
      const allergenTags = parsed.data.allergens.split(',').map((a: string) => a.trim()).filter(Boolean);
      tags = [...tags, ...allergenTags];
    }

    const item = await (prisma as any).menuItem.create({
      data: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        price: parsed.data.price,
        imageUrl: parsed.data.imageUrl || null,
        prepTime,
        isAvailable: parsed.data.isAvailable,
        isPopular: parsed.data.isPopular,
        tags: tags.length > 0 ? tags : null,
        course: parsed.data.course,
        sortOrder: parsed.data.sortOrder,
        productId: parsed.data.productId || null,
        companyId: companyId!,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create menu item');
  }
}
