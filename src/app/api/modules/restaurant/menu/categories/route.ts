/**
 * GET  /api/modules/restaurant/menu/categories — List menu categories
 * POST /api/modules/restaurant/menu/categories — Create category
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
    const includeItems = searchParams.get('includeItems') === 'true';

    const categories = await (prisma as any).menuCategory.findMany({
      where: { companyId: companyId!, isActive: true },
      orderBy: { sortOrder: 'asc' },
      ...(includeItems
        ? {
            include: {
              items: {
                orderBy: { sortOrder: 'asc' },
                include: { modifierGroups: { include: { modifiers: true }, orderBy: { sortOrder: 'asc' } } },
              },
            },
          }
        : {}),
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list categories');
  }
}

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional(),
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
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const category = await (prisma as any).menuCategory.create({
      data: { ...parsed.data, companyId: companyId! },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create category');
  }
}
