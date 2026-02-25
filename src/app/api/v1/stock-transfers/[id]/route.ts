/**
 * GET /api/v1/stock-transfers/[id] — Get a single transfer with items
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, companyId: companyId! },
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true, address: true } },
        toWarehouse: { select: { id: true, name: true, code: true, address: true } },
        items: {
          include: { product: { select: { quantity: true, unitPrice: true } } },
        },
      },
    });

    if (!transfer) return notFound('Stock transfer not found');
    return NextResponse.json(transfer);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get stock transfer');
  }
}
