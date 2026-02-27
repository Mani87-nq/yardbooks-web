/**
 * POST /api/modules/restaurant/reservations/[id]/no-show — Mark as no-show
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, conflict, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:reservations:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const reservation = await (prisma as any).reservation.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!reservation) return notFound('Reservation not found');
    if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
      return conflict(`Cannot mark no-show for a reservation with status "${reservation.status}"`);
    }

    // If reservation had a table assigned, free it
    if (reservation.tableId) {
      const table = await (prisma as any).restaurantTable.findFirst({
        where: { id: reservation.tableId, status: 'RESERVED' },
      });
      if (table) {
        await (prisma as any).restaurantTable.update({
          where: { id: reservation.tableId },
          data: { status: 'AVAILABLE' },
        });
      }
    }

    const updated = await (prisma as any).reservation.update({
      where: { id },
      data: { status: 'NO_SHOW' },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to mark no-show');
  }
}
