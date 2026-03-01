/**
 * GET  /api/modules/restaurant/reservations — List reservations (with date filter)
 * POST /api/modules/restaurant/reservations — Create a new reservation
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:reservations:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const status = searchParams.get('status');
    const filter = searchParams.get('filter'); // today, upcoming, past
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

    const where: any = {
      companyId: companyId!,
      ...(status ? { status } : {}),
    };

    // Handle filter shortcuts from the UI
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filter === 'today') {
      const filterDate = date || todayStart.toISOString().split('T')[0];
      const dayStart = new Date(`${filterDate}T00:00:00.000Z`);
      const dayEnd = new Date(`${filterDate}T23:59:59.999Z`);
      where.reservationDate = { gte: dayStart, lte: dayEnd };
    } else if (filter === 'upcoming') {
      where.reservationDate = { gt: todayEnd };
      if (!status) where.status = { in: ['PENDING', 'CONFIRMED'] };
    } else if (filter === 'past') {
      where.reservationDate = { lt: todayStart };
    } else if (date) {
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
    const rawData = hasMore ? reservations.slice(0, limit) : reservations;

    // Transform to match the front-end expected shape
    const data = rawData.map((r: any) => ({
      id: r.id,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      partySize: r.guestCount,
      date: r.reservationDate?.toISOString?.() || r.reservationDate,
      time: r.reservationTime,
      tableId: r.tableId,
      tableNumber: r.table?.number ? parseInt(r.table.number, 10) || r.table.number : null,
      status: r.status,
      specialRequests: r.specialRequests,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
    }));

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? rawData[rawData.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list reservations');
  }
}

const createReservationSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().max(30).nullable().optional(),
  customerEmail: z.string().email().nullable().optional(),
  customerId: z.string().optional(),
  tableId: z.string().nullable().optional(),
  // Accept both API-native and UI field names
  guestCount: z.number().int().min(1).max(100).optional(),
  partySize: z.number().int().min(1).max(100).optional(),
  reservationDate: z.string().optional(),
  date: z.string().optional(),
  reservationTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  duration: z.number().int().min(15).max(480).default(90),
  notes: z.string().max(1000).nullable().optional(),
  specialRequests: z.string().max(1000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:reservations:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

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

    // Resolve aliased field names (UI sends partySize/date/time, API stores guestCount/reservationDate/reservationTime)
    const guestCount = parsed.data.guestCount || parsed.data.partySize;
    const reservationDate = parsed.data.reservationDate || parsed.data.date;
    const reservationTime = parsed.data.reservationTime || parsed.data.time;

    if (!guestCount || !reservationDate || !reservationTime) {
      return badRequest('guestCount (or partySize), date, and time are required');
    }

    const reservation = await (prisma as any).reservation.create({
      data: {
        companyId: companyId!,
        customerName: parsed.data.customerName,
        customerPhone: parsed.data.customerPhone || null,
        customerEmail: parsed.data.customerEmail || null,
        customerId: parsed.data.customerId || null,
        tableId: parsed.data.tableId || null,
        guestCount,
        reservationDate: new Date(reservationDate),
        reservationTime,
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
