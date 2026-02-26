/**
 * GET /api/v1/reports/stock-valuation — Inventory Valuation Report
 *
 * Returns total inventory value using weighted average cost method.
 * Includes per-product breakdown and category summary.
 *
 * Query params:
 *   category — optional filter by product category
 *   lowStock — optional "true" to only show products at/below reorder level
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const lowStock = searchParams.get('lowStock') === 'true';

    // Get all active products with stock
    const products = await prisma.product.findMany({
      where: {
        companyId: companyId!,
        isActive: true,
        deletedAt: null,
        ...(category ? { category } : {}),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        quantity: true,
        costPrice: true,
        averageCost: true,
        unitPrice: true,
        reorderLevel: true,
        costingMethod: true,
        unit: true,
      },
      orderBy: { name: 'asc' },
    });

    // Build product valuation list
    const items = products
      .map(p => {
        const qty = Number(p.quantity);
        const avgCost = Number(p.averageCost) || Number(p.costPrice) || 0;
        const totalValue = qty * avgCost;
        const retailValue = qty * Number(p.unitPrice);
        const potentialMargin = retailValue > 0
          ? ((retailValue - totalValue) / retailValue) * 100 : 0;
        const isLowStock = qty <= Number(p.reorderLevel);

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category || 'Uncategorized',
          unit: p.unit,
          costingMethod: p.costingMethod,
          quantity: round4(qty),
          averageCost: round4(avgCost),
          costPrice: round2(Number(p.costPrice)),
          totalValue: round2(totalValue),
          unitPrice: round2(Number(p.unitPrice)),
          retailValue: round2(retailValue),
          potentialMargin: round2(potentialMargin),
          reorderLevel: round4(Number(p.reorderLevel)),
          isLowStock,
        };
      })
      .filter(p => !lowStock || p.isLowStock);

    // Category summary
    const categoryMap = new Map<string, {
      itemCount: number;
      totalQuantity: number;
      totalCostValue: number;
      totalRetailValue: number;
    }>();

    for (const item of items) {
      const existing = categoryMap.get(item.category) ?? {
        itemCount: 0,
        totalQuantity: 0,
        totalCostValue: 0,
        totalRetailValue: 0,
      };
      existing.itemCount += 1;
      existing.totalQuantity += item.quantity;
      existing.totalCostValue += item.totalValue;
      existing.totalRetailValue += item.retailValue;
      categoryMap.set(item.category, existing);
    }

    const categories = Array.from(categoryMap.entries())
      .map(([cat, data]) => ({
        category: cat,
        itemCount: data.itemCount,
        totalQuantity: round4(data.totalQuantity),
        totalCostValue: round2(data.totalCostValue),
        totalRetailValue: round2(data.totalRetailValue),
        potentialMargin: data.totalRetailValue > 0
          ? round2(((data.totalRetailValue - data.totalCostValue) / data.totalRetailValue) * 100)
          : 0,
      }))
      .sort((a, b) => b.totalCostValue - a.totalCostValue);

    // Totals
    const totalCostValue = items.reduce((s, i) => s + i.totalValue, 0);
    const totalRetailValue = items.reduce((s, i) => s + i.retailValue, 0);
    const lowStockCount = items.filter(i => i.isLowStock).length;

    return NextResponse.json({
      report: 'Stock Valuation Report',
      asOfDate: new Date().toISOString().split('T')[0],
      currency: 'JMD',
      summary: {
        totalProducts: items.length,
        totalCostValue: round2(totalCostValue),
        totalRetailValue: round2(totalRetailValue),
        potentialGrossProfit: round2(totalRetailValue - totalCostValue),
        potentialGrossMargin: totalRetailValue > 0
          ? round2(((totalRetailValue - totalCostValue) / totalRetailValue) * 100) : 0,
        lowStockItems: lowStockCount,
      },
      categories,
      items,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate stock valuation report');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
