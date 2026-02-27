/**
 * POST /api/modules/restaurant/reservations/[id]/seat — Mark reservation as seated
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { notFound, conflict, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:reservations:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const reservation = await (prisma as any).reservation.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!reservation) return notFound('Reservation not found');
    if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
      return conflict(`Cannot seat a reservation with status "${reservation.status}"`);
    }

    const updated = await (prisma as any).reservation.update({
      where: { id },
      data: { status: 'SEATED' },
      include: { table: { select: { id: true, number: true, section: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to mark reservation as seated');
  }
}
