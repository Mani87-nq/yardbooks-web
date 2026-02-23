/**
 * GET /api/v1/stock-counts/[id] — Get stock count with items
 * PUT /api/v1/stock-counts/[id] — Update stock count
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

    const stockCount = await prisma.stockCount.findFirst({
      where: { id, companyId: companyId! },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
          orderBy: { productName: 'asc' },
        },
        journalEntry: { select: { id: true, entryNumber: true, status: true } },
      },
    });
    if (!stockCount) return notFound('Stock count not found');
    return NextResponse.json(stockCount);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get stock count');
  }
}

const updateStockCountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['FULL', 'CYCLE', 'SPOT', 'ANNUAL']).optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'CANCELLED']).optional(),
  scheduledDate: z.coerce.date().optional(),
  warehouseId: z.string().optional(),
  warehouseName: z.string().max(200).optional(),
  categoryIds: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
  countedBy: z.string().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.stockCount.findFirst({ where: { id, companyId: companyId! } });
    if (!existing) return notFound('Stock count not found');

    // Cannot update approved or posted counts
    if (['APPROVED', 'POSTED'].includes(existing.status)) {
      return badRequest('Cannot update a stock count that has been approved or posted');
    }

    const body = await request.json();
    const parsed = updateStockCountSchema.safeParse(body);
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

    // Track status transitions
    if (parsed.data.status === 'IN_PROGRESS' && existing.status === 'DRAFT') {
      updateData.startedAt = new Date();
    }

    const stockCount = await prisma.stockCount.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    return NextResponse.json(stockCount);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update stock count');
  }
}
