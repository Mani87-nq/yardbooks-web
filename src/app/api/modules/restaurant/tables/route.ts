/**
 * GET  /api/modules/restaurant/tables — List tables (company-scoped)
 * POST /api/modules/restaurant/tables — Create a new table
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:tables:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const includeSession = searchParams.get('includeSession') === 'true';

    const where = {
      companyId: companyId!,
      isActive: true,
      ...(section ? { section } : {}),
      ...(status ? { status } : {}),
    };

    const tables = await (prisma as any).restaurantTable.findMany({
      where,
      orderBy: [{ section: 'asc' }, { number: 'asc' }],
      ...(includeSession
        ? {
            include: {
              sessions: {
                where: { status: 'ACTIVE' },
                take: 1,
                orderBy: { seatedAt: 'desc' },
              },
            },
          }
        : {}),
    });

    return NextResponse.json({ data: tables });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list tables');
  }
}

const createTableSchema = z.object({
  number: z.union([z.string().min(1).max(20), z.number()]).transform(String),
  name: z.string().max(100).nullable().optional(),
  section: z.string().max(50).nullable().optional(),
  capacity: z.number().int().min(1).max(50).default(4),
  shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE', 'BAR_SEAT']).default('SQUARE'),
  posX: z.number().min(0).max(100).optional(),
  posY: z.number().min(0).max(100).optional(),
  width: z.number().min(1).max(100).optional(),
  height: z.number().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:tables:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const body = await request.json();
    const parsed = createTableSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Check uniqueness of table number within company
    const existing = await (prisma as any).restaurantTable.findFirst({
      where: { companyId: companyId!, number: parsed.data.number },
    });
    if (existing) {
      return badRequest(`Table "${parsed.data.number}" already exists`);
    }

    const table = await (prisma as any).restaurantTable.create({
      data: { ...parsed.data, companyId: companyId! },
    });

    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create table');
  }
}
