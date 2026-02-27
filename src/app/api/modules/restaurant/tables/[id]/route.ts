/**
 * GET/PUT/DELETE /api/modules/restaurant/tables/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:tables:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const table = await (prisma as any).restaurantTable.findFirst({
      where: { id, companyId: companyId! },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          take: 1,
          orderBy: { seatedAt: 'desc' },
          include: { kitchenOrders: { include: { items: true } } },
        },
        reservations: {
          where: {
            status: { in: ['PENDING', 'CONFIRMED'] },
            reservationDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
          orderBy: { reservationDate: 'asc' },
          take: 5,
        },
      },
    });
    if (!table) return notFound('Table not found');

    return NextResponse.json(table);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get table');
  }
}

const updateTableSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  section: z.string().max(50).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE', 'BAR_SEAT']).optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'CLOSED']).optional(),
  posX: z.number().min(0).max(100).optional(),
  posY: z.number().min(0).max(100).optional(),
  width: z.number().min(1).max(100).optional(),
  height: z.number().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:tables:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    const existing = await (prisma as any).restaurantTable.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Table not found');

    const body = await request.json();
    const parsed = updateTableSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    // If changing number, check uniqueness
    if (parsed.data.number && parsed.data.number !== existing.number) {
      const dup = await (prisma as any).restaurantTable.findFirst({
        where: { companyId: companyId!, number: parsed.data.number, id: { not: id } },
      });
      if (dup) return badRequest(`Table "${parsed.data.number}" already exists`);
    }

    const table = await (prisma as any).restaurantTable.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(table);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update table');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'restaurant:tables:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr3 } = await requireModule(companyId!, 'restaurant');
    if (modErr3) return modErr3;

    const existing = await (prisma as any).restaurantTable.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Table not found');

    // Soft-delete by marking inactive
    await (prisma as any).restaurantTable.update({
      where: { id },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete table');
  }
}
