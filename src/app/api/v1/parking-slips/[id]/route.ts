/**
 * GET /api/v1/parking-slips/[id] — Get a single parking slip
 * PUT /api/v1/parking-slips/[id] — Update a parking slip
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const parkingSlip = await prisma.parkingSlip.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!parkingSlip) return notFound('Parking slip not found');
    return NextResponse.json(parkingSlip);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get parking slip');
  }
}

const updateParkingSlipSchema = z.object({
  vehiclePlate: z.string().min(1).max(20).optional(),
  vehicleType: z.enum(['CAR', 'MOTORCYCLE', 'TRUCK', 'BUS', 'OTHER']).optional(),
  vehicleColor: z.string().max(50).optional(),
  vehicleDescription: z.string().max(500).optional(),
  driverName: z.string().max(200).optional(),
  driverPhone: z.string().max(30).optional(),
  lotId: z.string().optional(),
  lotName: z.string().max(200).optional(),
  spotNumber: z.string().max(20).optional(),
  hourlyRate: z.number().positive().optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['ACTIVE', 'CANCELLED', 'EXPIRED']).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.parkingSlip.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Parking slip not found');

    if (existing.status === 'COMPLETED') {
      return badRequest('Cannot update a completed parking slip');
    }

    const body = await request.json();
    const parsed = updateParkingSlipSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.vehiclePlate) {
      updateData.vehiclePlate = parsed.data.vehiclePlate.toUpperCase();
    }

    const parkingSlip = await prisma.parkingSlip.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(parkingSlip);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update parking slip');
  }
}
