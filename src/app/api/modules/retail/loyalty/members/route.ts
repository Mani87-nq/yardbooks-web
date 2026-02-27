/**
 * GET /api/modules/retail/loyalty/members — List all loyalty members (with search, pagination, filtering)
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const search = searchParams.get('search') ?? undefined;
    const tier = searchParams.get('tier') ?? undefined;
    const programId = searchParams.get('programId') ?? undefined;
    const sortBy = searchParams.get('sortBy') ?? 'enrolledAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {
      companyId: companyId!,
      ...(tier ? { tier } : {}),
      ...(programId ? { loyaltyProgramId: programId } : {}),
      ...(search
        ? {
            OR: [
              { cardNumber: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
              { customer: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const validSortFields: Record<string, unknown> = {
      enrolledAt: { enrolledAt: sortOrder },
      pointsBalance: { pointsBalance: sortOrder },
      lifetimePoints: { lifetimePoints: sortOrder },
      lastActivityAt: { lastActivityAt: sortOrder },
    };

    const orderBy = validSortFields[sortBy] || { enrolledAt: 'desc' };

    const members = await (prisma as any).loyaltyMember.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        loyaltyProgram: { select: { id: true, name: true } },
      },
    });

    const hasMore = members.length > limit;
    const data = hasMore ? members.slice(0, limit) : members;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    // Get total count
    const total = await (prisma as any).loyaltyMember.count({ where });

    return NextResponse.json({
      data,
      total,
      pagination: { nextCursor, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list loyalty members');
  }
}
