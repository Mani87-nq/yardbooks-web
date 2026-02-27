/**
 * GET  /api/modules/salon/appointments — List appointments (filterable by date range, stylist)
 * POST /api/modules/salon/appointments — Create a new appointment
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError, conflict } from '@/lib/api-error';

// ---- Helpers ----

/** Convert "HH:MM" to minutes from midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Add minutes to "HH:MM" and return "HH:MM" */
function addMinutesToTime(time: string, minutes: number): string {
  const total = timeToMinutes(time) + minutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Check if two time ranges overlap */
function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  return aS < bE && bS < aE;
}

// ---- GET (List) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(
      request,
      'salon:appointments:read'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const stylistId = searchParams.get('stylistId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {
      companyId: companyId!,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(stylistId ? { stylistId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerPhone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const appointments = await (prisma as any).appointment.findMany({
      where,
      include: {
        stylist: true,
        services: {
          include: { service: true },
        },
        customer: true,
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json({ data: appointments });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to list appointments'
    );
  }
}

// ---- POST (Create) ----

const createAppointmentSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().max(20).nullable().optional(),
  customerEmail: z.string().email().nullable().optional(),
  customerId: z.string().nullable().optional(),
  stylistId: z.string().min(1),
  date: z.string(), // ISO date "YYYY-MM-DD"
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(2000).nullable().optional(),
  depositPaid: z.number().min(0).optional(),
  serviceIds: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(
      request,
      'salon:appointments:create'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const data = parsed.data;

    // Verify stylist belongs to company and is active
    const stylist = await (prisma as any).stylist.findFirst({
      where: { id: data.stylistId, companyId: companyId!, isActive: true },
    });
    if (!stylist) {
      return badRequest('Stylist not found or inactive');
    }

    // Fetch services and calculate totals
    const services = await (prisma as any).salonService.findMany({
      where: {
        id: { in: data.serviceIds },
        companyId: companyId!,
        isActive: true,
      },
    });

    if (services.length !== data.serviceIds.length) {
      return badRequest('One or more services not found or inactive');
    }

    // Check for stylist-specific overrides
    const stylistServices = await (prisma as any).stylistService.findMany({
      where: {
        stylistId: data.stylistId,
        serviceId: { in: data.serviceIds },
      },
    });
    const overrideMap = new Map<string, any>(
      stylistServices.map((ss: any) => [ss.serviceId, ss])
    );

    let totalDuration = 0;
    let totalPrice = 0;
    const appointmentServices: Array<{
      serviceId: string;
      price: number;
      duration: number;
      commission: number;
    }> = [];

    for (const svc of services) {
      const override = overrideMap.get(svc.id);
      const price = Number(override?.customPrice ?? svc.price);
      const duration = override?.customDuration ?? svc.duration;
      const bufferTime = svc.bufferTime || 0;

      // Calculate commission
      const commRate = Number(
        override?.commissionOverride ?? svc.commissionRate ?? stylist.defaultCommissionRate ?? 0
      );
      const commType = svc.commissionType || stylist.defaultCommissionType || 'PERCENTAGE';
      const commission =
        commType === 'PERCENTAGE' ? (price * commRate) / 100 : commRate;

      totalDuration += duration + bufferTime;
      totalPrice += price;

      appointmentServices.push({
        serviceId: svc.id,
        price,
        duration,
        commission: Math.round(commission * 100) / 100,
      });
    }

    const endTime = addMinutesToTime(data.startTime, totalDuration);

    // Check for conflicts: existing appointments for this stylist at this date/time
    const existingAppointments = await (prisma as any).appointment.findMany({
      where: {
        stylistId: data.stylistId,
        date: new Date(data.date),
        status: { in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS'] },
      },
    });

    const hasConflict = existingAppointments.some((appt: any) =>
      timesOverlap(data.startTime, endTime, appt.startTime, appt.endTime)
    );

    if (hasConflict) {
      return conflict(
        'This time slot conflicts with an existing appointment for this stylist'
      );
    }

    // Create appointment with services
    const appointment = await (prisma as any).appointment.create({
      data: {
        companyId: companyId!,
        customerName: data.customerName,
        customerPhone: data.customerPhone || null,
        customerEmail: data.customerEmail || null,
        customerId: data.customerId || null,
        stylistId: data.stylistId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime,
        totalDuration,
        totalPrice,
        depositPaid: data.depositPaid || 0,
        notes: data.notes || null,
        status: 'BOOKED',
        services: {
          create: appointmentServices,
        },
      },
      include: {
        stylist: true,
        services: { include: { service: true } },
      },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to create appointment'
    );
  }
}
