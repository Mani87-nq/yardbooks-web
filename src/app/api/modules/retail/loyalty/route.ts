/**
 * GET  /api/modules/retail/loyalty — List loyalty programs (company-scoped)
 * POST /api/modules/retail/loyalty — Create a new loyalty program
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
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where = {
      companyId: companyId!,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const programs = await (prisma as any).loyaltyProgram.findMany({
      where,
      include: {
        _count: {
          select: { members: true, transactions: true, rewards: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: programs, total: programs.length });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list loyalty programs');
  }
}

// ---- POST (Create) ----

const createProgramSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).nullable().optional(),
  pointsPerDollar: z.number().min(0).max(1000).default(1),
  pointsRounding: z.enum(['FLOOR', 'ROUND', 'CEIL']).default('FLOOR'),
  rewardThreshold: z.int().min(1).default(100),
  isActive: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createProgramSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const program = await (prisma as any).loyaltyProgram.create({
      data: {
        ...parsed.data,
        companyId: companyId!,
      },
    });

    return NextResponse.json(program, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create loyalty program');
  }
}
