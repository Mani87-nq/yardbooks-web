/**
 * POST /api/v1/stock-transfers/[id]/approve — Approve a pending transfer
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!transfer) return notFound('Stock transfer not found');

    if (!['DRAFT', 'PENDING'].includes(transfer.status)) {
      return badRequest(`Cannot approve a transfer with status "${transfer.status}".`);
    }

    const updated = await prisma.stockTransfer.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: user!.sub,
        approvedAt: new Date(),
      },
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        items: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to approve transfer');
  }
}
