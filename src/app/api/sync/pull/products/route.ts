/**
 * GET /api/sync/pull/products
 *
 * Returns the product catalog for offline caching.
 * Supports incremental sync via ?since=<timestamp> parameter.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const where: Record<string, unknown> = {
      companyId: companyId!,
    };

    // Incremental sync: only return products updated since the given timestamp
    if (since) {
      const sinceDate = new Date(parseInt(since));
      where.updatedAt = { gte: sinceDate };
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        unitPrice: true,
        costPrice: true,
        category: true,
        isActive: true,
        quantity: true,
        barcode: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    // Transform to offline format
    const offlineProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: Math.round(Number(p.unitPrice || 0) * 100), // Convert to cents
      costPrice: p.costPrice ? Math.round(Number(p.costPrice) * 100) : null,
      category: p.category,
      imageUrl: null,
      gctRate: 'STANDARD',
      inStock: p.isActive !== false && (p.quantity === null || Number(p.quantity) > 0),
      stockQuantity: p.quantity ? Number(p.quantity) : null,
      barcode: p.barcode,
      variants: [],
      lastSynced: Date.now(),
    }));

    return NextResponse.json({
      products: offlineProducts,
      count: offlineProducts.length,
      syncTimestamp: Date.now(),
    });
  } catch (error) {
    console.error('[SYNC] Products pull error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products for offline cache' },
      { status: 500 }
    );
  }
}
