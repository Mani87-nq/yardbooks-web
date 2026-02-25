/**
 * GET /api/v1/pos/returns/[id] — Get a single return with items + original order info
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

    const posReturn = await prisma.posReturn.findFirst({
      where: { id, companyId: companyId! },
      include: {
        items: true,
        originalOrder: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            total: true,
            status: true,
            completedAt: true,
          },
        },
      },
    });

    if (!posReturn) return notFound('Return not found');

    return NextResponse.json(posReturn);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get return');
  }
}
