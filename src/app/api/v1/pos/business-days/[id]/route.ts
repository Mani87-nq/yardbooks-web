/**
 * GET /api/v1/pos/business-days/[id] — Get a single business day with full details
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const day = await prisma.businessDay.findFirst({
      where: { id, companyId: companyId! },
      include: {
        sessions: {
          include: {
            terminal: { select: { id: true, name: true, location: true } },
            cashMovements: { orderBy: { performedAt: 'asc' } },
            _count: { select: { orders: true } },
          },
          orderBy: { openedAt: 'desc' },
        },
        eodReport: true,
      },
    });

    if (!day) return notFound('Business day not found');
    return NextResponse.json(day);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get business day');
  }
}
