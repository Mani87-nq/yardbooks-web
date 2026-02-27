/**
 * GET  /api/modules/retail/segments — List customer segments (company-scoped)
 * POST /api/modules/retail/segments — Create a new customer segment
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ---- GET (List) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const type = searchParams.get('type') ?? undefined; // MANUAL or AUTO
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {
      companyId: companyId!,
      ...(includeInactive ? {} : { isActive: true }),
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const segments = await (prisma as any).customerSegment.findMany({
      where,
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: segments, total: segments.length });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list customer segments');
  }
}

// ---- POST (Create) ----

const segmentRuleSchema = z.object({
  field: z.string(), // e.g., 'totalSpend', 'orderCount', 'lastOrderDate', 'parish'
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

const createSegmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).nullable().optional(),
  type: z.enum(['MANUAL', 'AUTO']).default('MANUAL'),
  rules: z.array(segmentRuleSchema).nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createSegmentSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // If type is AUTO, rules are required
    if (parsed.data.type === 'AUTO' && (!parsed.data.rules || parsed.data.rules.length === 0)) {
      return badRequest('Auto segments require at least one rule');
    }

    const segment = await (prisma as any).customerSegment.create({
      data: {
        ...parsed.data,
        companyId: companyId!,
        rules: parsed.data.rules || null,
        memberCount: 0,
      },
    });

    return NextResponse.json(segment, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create customer segment');
  }
}
