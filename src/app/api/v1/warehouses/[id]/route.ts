/**
 * GET    /api/v1/warehouses/[id] — Get warehouse
 * PUT    /api/v1/warehouses/[id] — Update warehouse
 * DELETE /api/v1/warehouses/[id] — Delete warehouse (soft)
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

    const warehouse = await prisma.warehouse.findFirst({
      where: { id, companyId: companyId! },
      include: {
        _count: { select: { outgoingTransfers: true, incomingTransfers: true } },
      },
    });
    if (!warehouse) return notFound('Warehouse not found');

    return NextResponse.json(warehouse);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get warehouse');
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  parish: z.string().optional(),
  phone: z.string().max(30).optional(),
  email: z.email().optional(),
  manager: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Validation failed');
    }

    const existing = await prisma.warehouse.findFirst({ where: { id, companyId: companyId! } });
    if (!existing) return notFound('Warehouse not found');

    const warehouse = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.warehouse.updateMany({
          where: { companyId: companyId!, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.address !== undefined && { address: parsed.data.address }),
          ...(parsed.data.parish !== undefined && { parish: parsed.data.parish as any }),
          ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
          ...(parsed.data.email !== undefined && { email: parsed.data.email }),
          ...(parsed.data.manager !== undefined && { manager: parsed.data.manager }),
          ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
          ...(parsed.data.isDefault !== undefined && { isDefault: parsed.data.isDefault }),
        },
      });
    });

    return NextResponse.json(warehouse);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update warehouse');
  }
}
