/**
 * POST /api/modules/restaurant/tables/[id]/seat — Seat guests (creates TableSession)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { notFound, badRequest, conflict, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const seatSchema = z.object({
  guestCount: z.number().int().min(1).max(50),
  serverId: z.string().optional(),
  notes: z.string().max(500).optional(),
  reservationId: z.string().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:tables:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const table = await (prisma as any).restaurantTable.findFirst({
      where: { id, companyId: companyId!, isActive: true },
    });
    if (!table) return notFound('Table not found');
    if (table.status === 'OCCUPIED') {
      return conflict('Table is already occupied');
    }

    const body = await request.json();
    const parsed = seatSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    if (parsed.data.guestCount > table.capacity) {
      return badRequest(`Table capacity is ${table.capacity} but ${parsed.data.guestCount} guests requested`);
    }

    // Use transaction to create session and update table status atomically
    const result = await (prisma as any).$transaction(async (tx: any) => {
      const session = await tx.tableSession.create({
        data: {
          companyId: companyId!,
          tableId: id,
          guestCount: parsed.data.guestCount,
          serverId: parsed.data.serverId || null,
          notes: parsed.data.notes || null,
          status: 'ACTIVE',
        },
      });

      await tx.restaurantTable.update({
        where: { id },
        data: { status: 'OCCUPIED' },
      });

      // If seating from a reservation, mark it as seated
      if (parsed.data.reservationId) {
        await tx.reservation.update({
          where: { id: parsed.data.reservationId },
          data: { status: 'SEATED' },
        });
      }

      return session;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to seat guests');
  }
}
