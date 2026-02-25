/**
 * GET /api/v1/pos/reports/daily-sales — Daily sales analytics
 *
 * Query params:
 *   date  — ISO date string (defaults to today)
 *
 * Returns:
 *   salesByHour        — array of { hour, orderCount, total }
 *   topProductsByQty   — top 10 products by quantity sold
 *   topProductsByRev   — top 10 products by revenue
 *   paymentBreakdown   — totals per payment method
 *   summary            — overall stats (orderCount, grossSales, discounts, netSales, avgTransaction, gctCollected)
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
    const dateParam = searchParams.get('date');

    // Parse date — default to today
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return badRequest('Invalid date format. Use YYYY-MM-DD.');
      }
    } else {
      targetDate = new Date();
    }

    // Build start/end of the target day (UTC)
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Fetch all completed orders for the day
    const orders = await prisma.posOrder.findMany({
      where: {
        companyId: companyId!,
        status: 'COMPLETED',
        completedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        items: {
          select: {
            productId: true,
            name: true,
            quantity: true,
            lineTotal: true,
            lineTotalBeforeTax: true,
            unitPrice: true,
          },
        },
        payments: {
          where: { status: 'COMPLETED' },
          select: { method: true, amount: true },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    // ---- Sales by hour ----
    const hourMap = new Map<number, { orderCount: number; total: number }>();
    for (let h = 0; h < 24; h++) {
      hourMap.set(h, { orderCount: 0, total: 0 });
    }
    for (const order of orders) {
      const hour = order.completedAt ? new Date(order.completedAt).getUTCHours() : 0;
      const bucket = hourMap.get(hour)!;
      bucket.orderCount += 1;
      bucket.total += Number(order.total);
    }
    const salesByHour = Array.from(hourMap.entries()).map(([hour, data]) => ({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      orderCount: data.orderCount,
      total: Math.round(data.total * 100) / 100,
    }));

    // ---- Top products ----
    const productMap = new Map<string, {
      productId: string | null;
      name: string;
      totalQty: number;
      totalRevenue: number;
    }>();

    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId ?? item.name;
        const existing = productMap.get(key);
        if (existing) {
          existing.totalQty += Number(item.quantity);
          existing.totalRevenue += Number(item.lineTotal);
        } else {
          productMap.set(key, {
            productId: item.productId,
            name: item.name,
            totalQty: Number(item.quantity),
            totalRevenue: Number(item.lineTotal),
          });
        }
      }
    }

    const allProducts = Array.from(productMap.values());

    const topProductsByQty = [...allProducts]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 10)
      .map((p, i) => ({
        rank: i + 1,
        productId: p.productId,
        name: p.name,
        quantity: Math.round(p.totalQty * 100) / 100,
        revenue: Math.round(p.totalRevenue * 100) / 100,
      }));

    const topProductsByRev = [...allProducts]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map((p, i) => ({
        rank: i + 1,
        productId: p.productId,
        name: p.name,
        quantity: Math.round(p.totalQty * 100) / 100,
        revenue: Math.round(p.totalRevenue * 100) / 100,
      }));

    // ---- Payment method breakdown ----
    const paymentMap = new Map<string, { count: number; total: number }>();
    for (const order of orders) {
      for (const payment of order.payments) {
        const method = payment.method;
        const existing = paymentMap.get(method) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += Number(payment.amount);
        paymentMap.set(method, existing);
      }
    }
    const paymentBreakdown = Array.from(paymentMap.entries())
      .map(([method, data]) => ({
        method,
        methodLabel: method.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        count: data.count,
        total: Math.round(data.total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    // ---- Summary ----
    const orderCount = orders.length;
    const grossSales = orders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const discounts = orders.reduce((sum, o) => sum + Number(o.orderDiscountAmount), 0);
    const netSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const gctCollected = orders.reduce((sum, o) => sum + Number(o.gctAmount), 0);
    const avgTransaction = orderCount > 0 ? netSales / orderCount : 0;

    const summary = {
      date: startOfDay.toISOString().split('T')[0],
      orderCount,
      grossSales: Math.round(grossSales * 100) / 100,
      discounts: Math.round(discounts * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      gctCollected: Math.round(gctCollected * 100) / 100,
      avgTransaction: Math.round(avgTransaction * 100) / 100,
    };

    return NextResponse.json({
      salesByHour,
      topProductsByQty,
      topProductsByRev,
      paymentBreakdown,
      summary,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate daily sales report');
  }
}
