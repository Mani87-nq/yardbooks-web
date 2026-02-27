/**
 * POST /api/modules/salon/appointments/[id]/confirm — Confirm an appointment
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(
      request,
      'salon:appointments:update'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const appointment = await (prisma as any).appointment.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!appointment) return notFound('Appointment not found');

    if (appointment.status !== 'BOOKED') {
      return badRequest(
        `Cannot confirm appointment with status "${appointment.status}". Only BOOKED appointments can be confirmed.`
      );
    }

    const updated = await (prisma as any).appointment.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
      include: {
        stylist: true,
        services: { include: { service: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to confirm appointment');
  }
}
