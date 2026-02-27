/**
 * GET    /api/modules/salon/appointments/[id] — Get a single appointment
 * PUT    /api/modules/salon/appointments/[id] — Update/reschedule an appointment
 * DELETE /api/modules/salon/appointments/[id] — Delete an appointment
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { notFound, badRequest, internalError, conflict } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

/** Convert "HH:MM" to minutes from midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function addMinutesToTime(time: string, minutes: number): string {
  const total = timeToMinutes(time) + minutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

// ---- GET ----

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'salon:appointments:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const appointment = await (prisma as any).appointment.findFirst({
      where: { id, companyId: companyId! },
      include: {
        stylist: true,
        customer: true,
        services: {
          include: { service: { include: { category: true } } },
        },
      },
    });

    if (!appointment) return notFound('Appointment not found');

    return NextResponse.json(appointment);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get appointment');
  }
}

// ---- PUT (Update/Reschedule) ----

const updateAppointmentSchema = z.object({
  customerName: z.string().min(1).max(200).optional(),
  customerPhone: z.string().max(20).nullable().optional(),
  customerEmail: z.string().email().nullable().optional(),
  stylistId: z.string().optional(),
  date: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(2000).nullable().optional(),
  depositPaid: z.number().min(0).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(
      request,
      'salon:appointments:update'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const existing = await (prisma as any).appointment.findFirst({
      where: { id, companyId: companyId! },
      include: { services: true },
    });
    if (!existing) return notFound('Appointment not found');

    // Can only edit BOOKED or CONFIRMED appointments
    if (!['BOOKED', 'CONFIRMED'].includes(existing.status)) {
      return badRequest(`Cannot edit appointment with status "${existing.status}"`);
    }

    const body = await request.json();
    const parsed = updateAppointmentSchema.safeParse(body);
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
    const newStylistId = data.stylistId || existing.stylistId;
    const newDate = data.date ? new Date(data.date) : existing.date;
    const newStartTime = data.startTime || existing.startTime;
    const newEndTime = addMinutesToTime(newStartTime, existing.totalDuration);

    // Check for conflicts if date/time/stylist changed
    if (data.date || data.startTime || data.stylistId) {
      const conflicts = await (prisma as any).appointment.findMany({
        where: {
          stylistId: newStylistId,
          date: newDate,
          status: { in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS'] },
          id: { not: id },
        },
      });

      const hasConflict = conflicts.some((appt: any) =>
        timesOverlap(newStartTime, newEndTime, appt.startTime, appt.endTime)
      );

      if (hasConflict) {
        return conflict('This time slot conflicts with an existing appointment');
      }
    }

    const appointment = await (prisma as any).appointment.update({
      where: { id },
      data: {
        ...(data.customerName !== undefined ? { customerName: data.customerName } : {}),
        ...(data.customerPhone !== undefined ? { customerPhone: data.customerPhone } : {}),
        ...(data.customerEmail !== undefined ? { customerEmail: data.customerEmail } : {}),
        ...(data.stylistId ? { stylistId: data.stylistId } : {}),
        ...(data.date ? { date: new Date(data.date) } : {}),
        ...(data.startTime ? { startTime: data.startTime, endTime: newEndTime } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.depositPaid !== undefined ? { depositPaid: data.depositPaid } : {}),
      },
      include: {
        stylist: true,
        services: { include: { service: true } },
      },
    });

    return NextResponse.json(appointment);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update appointment');
  }
}

// ---- DELETE ----

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(
      request,
      'salon:appointments:delete'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr3 } = await requireModule(companyId!, 'salon');
    if (modErr3) return modErr3;

    const existing = await (prisma as any).appointment.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Appointment not found');

    if (['IN_PROGRESS', 'COMPLETED'].includes(existing.status)) {
      return badRequest('Cannot delete an in-progress or completed appointment');
    }

    await (prisma as any).appointment.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete appointment');
  }
}
