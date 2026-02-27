/**
 * POST /api/modules/restaurant/tables/[id]/clear — Clear table (close session)
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, conflict, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:tables:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const table = await (prisma as any).restaurantTable.findFirst({
      where: { id, companyId: companyId!, isActive: true },
    });
    if (!table) return notFound('Table not found');
    if (table.status !== 'OCCUPIED' && table.status !== 'CLEANING') {
      return conflict('Table is not currently occupied');
    }

    await (prisma as any).$transaction(async (tx: any) => {
      // Close all active sessions for this table
      await tx.tableSession.updateMany({
        where: { tableId: id, status: { in: ['ACTIVE', 'BILL_REQUESTED'] } },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      // Set table to CLEANING status (staff will mark AVAILABLE when ready)
      await tx.restaurantTable.update({
        where: { id },
        data: { status: 'CLEANING' },
      });
    });

    return NextResponse.json({ success: true, message: 'Table cleared' });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to clear table');
  }
}
