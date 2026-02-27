/**
 * GET  /api/modules/salon/services/categories — List service categories
 * POST /api/modules/salon/services/categories — Create a new category
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ---- GET (List) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'salon:services:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const categories = await (prisma as any).salonServiceCategory.findMany({
      where: { companyId: companyId! },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list categories');
  }
}

// ---- POST (Create) ----

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'salon:services:create');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'salon');
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

    const category = await (prisma as any).salonServiceCategory.create({
      data: {
        ...parsed.data,
        companyId: companyId!,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return badRequest('A category with this name already exists');
    }
    return internalError(error instanceof Error ? error.message : 'Failed to create category');
  }
}
