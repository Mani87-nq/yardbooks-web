/**
 * GET  /api/modules/restaurant/reservations — List reservations (with date filter)
 * POST /api/modules/restaurant/reservations — Create a new reservation
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:reservations:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const status = searchParams.get('status');
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

    const where: any = {
      companyId: companyId!,
      ...(status ? { status } : {}),
    };

    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      where.reservationDate = { gte: dayStart, lte: dayEnd };
    }

    const reservations = await (prisma as any).reservation.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ reservationDate: 'asc' }, { reservationTime: 'asc' }],
      include: { table: { select: { id: true, number: true, section: true, capacity: true } } },
    });

    const hasMore = reservations.length > limit;
    const data = hasMore ? reservations.slice(0, limit) : reservations;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list reservations');
  }
}

const createReservationSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().max(30).optional(),
  customerEmail: z.string().email().optional(),
  customerId: z.string().optional(),
  tableId: z.string().optional(),
  guestCount: z.number().int().min(1).max(100),
  reservationDate: z.string(), // ISO date string
  reservationTime: z.string().regex(/^\d{2}:\d{2}$/), // "HH:mm"
  duration: z.number().int().min(15).max(480).default(90),
  notes: z.string().max(1000).optional(),
  specialRequests: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:reservations:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createReservationSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const reservation = await (prisma as any).reservation.create({
      data: {
        companyId: companyId!,
        customerName: parsed.data.customerName,
        customerPhone: parsed.data.customerPhone || null,
        customerEmail: parsed.data.customerEmail || null,
        customerId: parsed.data.customerId || null,
        tableId: parsed.data.tableId || null,
        guestCount: parsed.data.guestCount,
        reservationDate: new Date(parsed.data.reservationDate),
        reservationTime: parsed.data.reservationTime,
        duration: parsed.data.duration,
        notes: parsed.data.notes || null,
        specialRequests: parsed.data.specialRequests || null,
        status: 'PENDING',
      },
      include: { table: { select: { id: true, number: true, section: true } } },
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create reservation');
  }
}
