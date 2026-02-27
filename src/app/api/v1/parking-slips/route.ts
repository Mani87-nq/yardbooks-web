/**
 * GET  /api/v1/parking-slips — List parking slips (paginated, company-scoped)
 * POST /api/v1/parking-slips — Create a new parking slip (vehicle enters)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'inventory:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

    const statusParam = searchParams.get('status');
    const validStatuses = ['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as const;
    const status = statusParam && validStatuses.includes(statusParam as any) ? statusParam : undefined;
    if (statusParam && !status) {
      return badRequest('Invalid parking slip status');
    }

    const vehiclePlate = searchParams.get('vehiclePlate') ?? undefined;
    const lotId = searchParams.get('lotId') ?? undefined;
    const isPaidParam = searchParams.get('isPaid');
    const isPaid = isPaidParam === 'true' ? true : isPaidParam === 'false' ? false : undefined;

    const where = {
      companyId: companyId!,
      ...(status ? { status: status as any } : {}),
      ...(vehiclePlate ? { vehiclePlate: { contains: vehiclePlate, mode: 'insensitive' as const } } : {}),
      ...(lotId ? { lotId } : {}),
      ...(isPaid !== undefined ? { isPaid } : {}),
    };

    const parkingSlips = await prisma.parkingSlip.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { entryTime: 'desc' },
    });

    const hasMore = parkingSlips.length > limit;
    const data = hasMore ? parkingSlips.slice(0, limit) : parkingSlips;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list parking slips');
  }
}

const createParkingSlipSchema = z.object({
  vehiclePlate: z.string().min(1).max(20),
  vehicleType: z.enum(['CAR', 'MOTORCYCLE', 'TRUCK', 'BUS', 'OTHER']).optional(),
  vehicleColor: z.string().max(50).optional(),
  vehicleDescription: z.string().max(500).optional(),
  driverName: z.string().max(200).optional(),
  driverPhone: z.string().max(30).optional(),
  lotId: z.string().optional(),
  lotName: z.string().max(200).optional(),
  spotNumber: z.string().max(20).optional(),
  hourlyRate: z.number().positive(),
  entryTime: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'inventory:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createParkingSlipSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const slipNumber = await generateSlipNumber(companyId!);

    const parkingSlip = await prisma.parkingSlip.create({
      data: {
        slipNumber,
        companyId: companyId!,
        createdBy: user!.sub,
        vehiclePlate: parsed.data.vehiclePlate.toUpperCase(),
        vehicleType: parsed.data.vehicleType || null,
        vehicleColor: parsed.data.vehicleColor || null,
        vehicleDescription: parsed.data.vehicleDescription || null,
        driverName: parsed.data.driverName || null,
        driverPhone: parsed.data.driverPhone || null,
        lotId: parsed.data.lotId || null,
        lotName: parsed.data.lotName || null,
        spotNumber: parsed.data.spotNumber || null,
        hourlyRate: parsed.data.hourlyRate,
        entryTime: parsed.data.entryTime ?? new Date(),
        notes: parsed.data.notes || null,
      },
    });

    return NextResponse.json(parkingSlip, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create parking slip');
  }
}

async function generateSlipNumber(_companyId: string): Promise<string> {
  return `PKG-${Date.now().toString(36).toUpperCase()}`;
}
