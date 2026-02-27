/**
 * GET  /api/modules/salon/services — List salon services
 * POST /api/modules/salon/services — Create a new service
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ---- GET (List) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'salon:services:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId') ?? undefined;
    const activeOnly = searchParams.get('active') === 'true';
    const search = searchParams.get('search') ?? undefined;

    const where: any = {
      companyId: companyId!,
      ...(categoryId ? { categoryId } : {}),
      ...(activeOnly ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const services = await (prisma as any).salonService.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    return NextResponse.json({ data: services });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list services');
  }
}

// ---- POST (Create) ----

const createServiceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  categoryId: z.string().min(1),
  price: z.number().min(0),
  duration: z.number().int().min(5).max(480), // 5 min to 8 hours
  bufferTime: z.number().int().min(0).max(60).optional(),
  commissionType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'salon:services:create');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createServiceSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Verify category belongs to this company
    const category = await (prisma as any).salonServiceCategory.findFirst({
      where: { id: parsed.data.categoryId, companyId: companyId! },
    });
    if (!category) {
      return badRequest('Category not found');
    }

    const service = await (prisma as any).salonService.create({
      data: {
        ...parsed.data,
        companyId: companyId!,
      },
      include: { category: true },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create service');
  }
}
