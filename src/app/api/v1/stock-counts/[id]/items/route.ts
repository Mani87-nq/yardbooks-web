/**
 * GET  /api/v1/stock-counts/[id]/items — List items for a stock count
 * POST /api/v1/stock-counts/[id]/items — Add items to a stock count (batch)
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

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

    // Verify stock count belongs to company
    const stockCount = await prisma.stockCount.findFirst({
      where: { id, companyId: companyId! },
      select: { id: true },
    });
    if (!stockCount) return notFound('Stock count not found');

    const items = await prisma.stockCountItem.findMany({
      where: { stockCountId: id },
      include: { product: { select: { id: true, name: true, sku: true } } },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { productName: 'asc' },
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list stock count items');
  }
}

const stockCountItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1).max(300),
  sku: z.string().max(100),
  barcode: z.string().max(100).optional(),
  uomCode: z.string().max(20),
  expectedQuantity: z.number().min(0),
  countedQuantity: z.number().min(0).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const addItemsSchema = z.object({
  items: z.array(stockCountItemSchema).min(1).max(500),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify stock count exists and is in a mutable state
    const stockCount = await prisma.stockCount.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!stockCount) return notFound('Stock count not found');

    if (['APPROVED', 'POSTED', 'CANCELLED'].includes(stockCount.status)) {
      return badRequest('Cannot add items to a stock count that is approved, posted, or cancelled');
    }

    const body = await request.json();
    const parsed = addItemsSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const itemsToCreate = parsed.data.items.map((item) => {
      const variance = item.countedQuantity != null ? item.countedQuantity - item.expectedQuantity : null;
      return {
        stockCountId: id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode || null,
        uomCode: item.uomCode,
        expectedQuantity: item.expectedQuantity,
        countedQuantity: item.countedQuantity ?? null,
        variance,
        countedAt: item.countedQuantity != null ? new Date() : null,
        countedBy: item.countedQuantity != null ? user!.sub : null,
        location: item.location || null,
        notes: item.notes || null,
      };
    });

    const created = await prisma.stockCountItem.createMany({ data: itemsToCreate });

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

    return NextResponse.json({ created: created.count }, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to add stock count items');
  }
}
