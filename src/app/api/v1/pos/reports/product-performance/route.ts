/**
 * GET /api/v1/pos/reports/product-performance — Product performance analytics
 *
 * Query params:
 *   from  — ISO date string (defaults to 30 days ago)
 *   to    — ISO date string (defaults to today)
 *
 * Returns:
 *   products       — ranked product list with qty, revenue, cost, margin
 *   lowStockAlerts — products where current quantity <= reorderLevel
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Parse date range — default last 30 days
    let fromDate: Date;
    let toDate: Date;

    if (fromParam) {
      fromDate = new Date(fromParam);
      if (isNaN(fromDate.getTime())) {
        return badRequest('Invalid "from" date format. Use YYYY-MM-DD.');
      }
    } else {
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
    }
    fromDate.setUTCHours(0, 0, 0, 0);

    if (toParam) {
      toDate = new Date(toParam);
      if (isNaN(toDate.getTime())) {
        return badRequest('Invalid "to" date format. Use YYYY-MM-DD.');
      }
    } else {
      toDate = new Date();
    }
    toDate.setUTCHours(23, 59, 59, 999);

    // Fetch completed order items in the date range
    const orderItems = await prisma.posOrderItem.findMany({
      where: {
        order: {
          companyId: companyId!,
          status: 'COMPLETED',
          completedAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
      },
      select: {
        productId: true,
        name: true,
        quantity: true,
        unitPrice: true,
        lineTotal: true,
        lineTotalBeforeTax: true,
      },
    });

    // Aggregate by product
    const productMap = new Map<string, {
      productId: string | null;
      name: string;
      totalQty: number;
      totalRevenue: number;
      totalRevenueBeforeTax: number;
    }>();

    for (const item of orderItems) {
      const key = item.productId ?? item.name;
      const existing = productMap.get(key);
      if (existing) {
        existing.totalQty += Number(item.quantity);
        existing.totalRevenue += Number(item.lineTotal);
        existing.totalRevenueBeforeTax += Number(item.lineTotalBeforeTax);
      } else {
        productMap.set(key, {
          productId: item.productId,
          name: item.name,
          totalQty: Number(item.quantity),
          totalRevenue: Number(item.lineTotal),
          totalRevenueBeforeTax: Number(item.lineTotalBeforeTax),
        });
      }
    }

    // Fetch cost prices from Product table for margin calculation
    const productIds = Array.from(productMap.values())
      .map((p) => p.productId)
      .filter((id): id is string => id !== null);

    const productsWithCost = productIds.length > 0
      ? await prisma.product.findMany({
          where: {
            id: { in: productIds },
            companyId: companyId!,
          },
          select: {
            id: true,
            costPrice: true,
            unitPrice: true,
          },
        })
      : [];

    const costMap = new Map<string, { costPrice: number; unitPrice: number }>();
    for (const p of productsWithCost) {
      costMap.set(p.id, {
        costPrice: Number(p.costPrice),
        unitPrice: Number(p.unitPrice),
      });
    }

    // Build ranked product list
    const products = Array.from(productMap.values())
      .map((p) => {
        const costInfo = p.productId ? costMap.get(p.productId) : null;
        const totalCost = costInfo
          ? Math.round(costInfo.costPrice * p.totalQty * 100) / 100
          : 0;
        const profitMargin = p.totalRevenueBeforeTax > 0 && totalCost > 0
          ? Math.round(((p.totalRevenueBeforeTax - totalCost) / p.totalRevenueBeforeTax) * 10000) / 100
          : null;

        return {
          productId: p.productId,
          name: p.name,
          quantitySold: Math.round(p.totalQty * 100) / 100,
          revenue: Math.round(p.totalRevenue * 100) / 100,
          revenueBeforeTax: Math.round(p.totalRevenueBeforeTax * 100) / 100,
          totalCost,
          profitMargin, // percentage, e.g. 25.50 means 25.50%
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // ---- Low stock alerts ----
    // Prisma doesn't support field-to-field comparison in where clauses,
    // so we fetch products with a reorder level set and filter in JS.
    const productsForStockCheck = await prisma.product.findMany({
      where: {
        companyId: companyId!,
        isActive: true,
        deletedAt: null,
        reorderLevel: { gt: 0 },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        quantity: true,
        reorderLevel: true,
        unitPrice: true,
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    const lowStockAlerts = productsForStockCheck
      .filter((p) => Number(p.quantity) <= Number(p.reorderLevel))
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        currentStock: Number(p.quantity),
        reorderLevel: Number(p.reorderLevel),
        unitPrice: Number(p.unitPrice),
        category: p.category,
        deficit: Math.round((Number(p.reorderLevel) - Number(p.quantity)) * 100) / 100,
      }))
      .sort((a, b) => b.deficit - a.deficit);

    return NextResponse.json({
      dateRange: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
      products,
      lowStockAlerts,
    });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to generate product performance report'
    );
  }
}
