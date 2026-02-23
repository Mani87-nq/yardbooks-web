/**
 * POST /api/v1/stock-counts/[id]/approve — Approve a stock count
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const stockCount = await prisma.stockCount.findFirst({
      where: { id, companyId: companyId! },
      include: { _count: { select: { items: true } } },
    });
    if (!stockCount) return notFound('Stock count not found');

    // Only PENDING_REVIEW counts can be approved
    if (stockCount.status !== 'PENDING_REVIEW') {
      return badRequest('Stock count must be in PENDING_REVIEW status to approve');
    }

    // Ensure all items have been counted
    const uncountedItems = await prisma.stockCountItem.count({
      where: { stockCountId: id, countedQuantity: null },
    });
    if (uncountedItems > 0) {
      return badRequest(`${uncountedItems} item(s) have not been counted yet`);
    }

    const updated = await prisma.stockCount.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: user!.sub,
        approvedAt: new Date(),
        completedAt: new Date(),
      },
      include: { items: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to approve stock count');
  }
}
