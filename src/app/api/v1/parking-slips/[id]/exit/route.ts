/**
 * POST /api/v1/parking-slips/[id]/exit — Record vehicle exit, calculate duration + total amount
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const parkingSlip = await prisma.parkingSlip.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!parkingSlip) return notFound('Parking slip not found');

    if (parkingSlip.status !== 'ACTIVE') {
      return badRequest('Only active parking slips can be exited');
    }

    if (parkingSlip.exitTime) {
      return badRequest('Vehicle exit has already been recorded');
    }

    const exitTime = new Date();
    const entryTime = new Date(parkingSlip.entryTime);

    // Calculate duration in minutes
    const durationMinutes = Math.round((exitTime.getTime() - entryTime.getTime()) / 60000);

    // Calculate total amount: round up to next hour
    const hourlyRate = Number(parkingSlip.hourlyRate);
    const billedHours = Math.ceil(durationMinutes / 60);
    const totalAmount = billedHours * hourlyRate;

    const updated = await prisma.parkingSlip.update({
      where: { id },
      data: {
        exitTime,
        durationMinutes,
        totalAmount,
        status: 'COMPLETED',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to record vehicle exit');
  }
}
