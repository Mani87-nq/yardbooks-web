/**
 * POST /api/v1/parking-slips/[id]/payment — Record payment for a parking slip
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { requireFeature } from '@/lib/plan-gate.server';

type RouteContext = { params: Promise<{ id: string }> };

const paymentSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'mobile']),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { error: planError } = await requireFeature(request, 'parking_slip');
    if (planError) return planError;

    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const parkingSlip = await prisma.parkingSlip.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!parkingSlip) return notFound('Parking slip not found');

    if (parkingSlip.isPaid) {
      return badRequest('Parking slip has already been paid');
    }

    if (parkingSlip.status === 'CANCELLED') {
      return badRequest('Cannot record payment for a cancelled parking slip');
    }

    // Require exit to be recorded before payment (so total amount is calculated)
    if (!parkingSlip.exitTime && parkingSlip.status === 'ACTIVE') {
      return badRequest('Vehicle exit must be recorded before payment. Call the exit endpoint first.');
    }

    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const updated = await prisma.parkingSlip.update({
      where: { id },
      data: {
        isPaid: true,
        paymentMethod: parsed.data.paymentMethod,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to record payment');
  }
}
