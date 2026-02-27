/**
 * GET/PUT/DELETE /api/modules/restaurant/reservations/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:reservations:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const reservation = await (prisma as any).reservation.findFirst({
      where: { id, companyId: companyId! },
      include: { table: { select: { id: true, number: true, section: true, capacity: true } } },
    });
    if (!reservation) return notFound('Reservation not found');

    return NextResponse.json(reservation);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get reservation');
  }
}

const updateReservationSchema = z.object({
  customerName: z.string().min(1).max(200).optional(),
  customerPhone: z.string().max(30).optional(),
  customerEmail: z.string().email().optional(),
  tableId: z.string().optional(),
  guestCount: z.number().int().min(1).max(100).optional(),
  reservationDate: z.string().optional(),
  reservationTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  duration: z.number().int().min(15).max(480).optional(),
  notes: z.string().max(1000).optional(),
  specialRequests: z.string().max(1000).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:reservations:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const existing = await (prisma as any).reservation.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Reservation not found');

    const body = await request.json();
    const parsed = updateReservationSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const updateData: any = { ...parsed.data };
    if (parsed.data.reservationDate) {
      updateData.reservationDate = new Date(parsed.data.reservationDate);
    }

    const reservation = await (prisma as any).reservation.update({
      where: { id },
      data: updateData,
      include: { table: { select: { id: true, number: true, section: true } } },
    });

    return NextResponse.json(reservation);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update reservation');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:reservations:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr3 } = await requireModule(companyId!, 'restaurant');
    if (modErr3) return modErr3;

    const existing = await (prisma as any).reservation.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Reservation not found');

    await (prisma as any).reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to cancel reservation');
  }
}
