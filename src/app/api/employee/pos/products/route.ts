/**
 * GET /api/employee/pos/products — List active products for kiosk POS
 *
 * Returns products filterable by search term and category.
 * Paginated via cursor. Products are cached client-side in kioskPosStore.
 *
 * Product.category is a plain String? field (not a relation).
 * Product.gctRate is a GCTRate enum (STANDARD, TELECOM, TOURISM, ZERO_RATED, EXEMPT).
 * We map EXEMPT/ZERO_RATED → isGctExempt: true for kiosk cart compatibility.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const category = searchParams.get('category') ?? undefined;
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);

    const where: Record<string, unknown> = {
      companyId: companyId!,
      isActive: true,
      deletedAt: null,
    };

    // Search by name, SKU, or barcode
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by category (plain string field)
    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    const products = await prisma.product.findMany({
      where: where as any,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unitPrice: true,
        quantity: true,
        gctRate: true,
        imageUrl: true,
        category: true,
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { name: 'asc' },
    });

    const hasMore = products.length > limit;
    const data = hasMore ? products.slice(0, limit) : products;

    // Map to kiosk-friendly format
    const formatted = data.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      unitPrice: Number(p.unitPrice),
      quantity: Number(p.quantity),
      isGctExempt: p.gctRate === 'EXEMPT' || p.gctRate === 'ZERO_RATED',
      imageUrl: p.imageUrl,
      categoryName: p.category ?? null,
    }));

    // Collect unique categories for filter chips
    const categories = await prisma.product.findMany({
      where: {
        companyId: companyId!,
        isActive: true,
        deletedAt: null,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return NextResponse.json({
      data: formatted,
      categories: categories.map((c) => c.category).filter(Boolean) as string[],
      pagination: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
        limit,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list products');
  }
}
