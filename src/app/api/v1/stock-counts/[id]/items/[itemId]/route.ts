/**
 * PUT /api/v1/stock-counts/[id]/items/[itemId] — Update counted quantity / variance
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

const updateItemSchema = z.object({
  countedQuantity: z.number().min(0).optional(),
  varianceReason: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id, itemId } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify stock count belongs to company and is mutable
    const stockCount = await prisma.stockCount.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!stockCount) return notFound('Stock count not found');

    if (['APPROVED', 'POSTED', 'CANCELLED'].includes(stockCount.status)) {
      return badRequest('Cannot update items on a stock count that is approved, posted, or cancelled');
    }

    const existing = await prisma.stockCountItem.findFirst({
      where: { id: itemId, stockCountId: id },
    });
    if (!existing) return notFound('Stock count item not found');

    const body = await request.json();
    const parsed = updateItemSchema.safeParse(body);
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

    // Calculate variance when countedQuantity is provided
    if (parsed.data.countedQuantity != null) {
      const expectedQty = Number(existing.expectedQuantity);
      const countedQty = parsed.data.countedQuantity;
      updateData.variance = countedQty - expectedQty;
      updateData.countedAt = new Date();
      updateData.countedBy = user!.sub;
    }

    const item = await prisma.stockCountItem.update({
      where: { id: itemId },
      data: updateData,
      include: { product: { select: { id: true, name: true, sku: true } } },
    });

    // Update stock count summary
    const totalItems = await prisma.stockCountItem.count({ where: { stockCountId: id } });
    const itemsCounted = await prisma.stockCountItem.count({
      where: { stockCountId: id, countedQuantity: { not: null } },
    });
    const itemsWithVariance = await prisma.stockCountItem.count({
      where: {
        stockCountId: id,
        variance: { not: null },
        NOT: { variance: 0 },
      },
    });

    await prisma.stockCount.update({
      where: { id },
      data: { totalItems, itemsCounted, itemsWithVariance },
    });

    return NextResponse.json(item);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update stock count item');
  }
}
