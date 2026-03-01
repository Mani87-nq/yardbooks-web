/**
 * GET /api/v1/dashboard — Dashboard summary statistics
 *
 * Returns aggregated stats for the current company:
 * - Revenue / expenses / profit (current month)
 * - Outstanding receivables and overdue count
 * - Customer, invoice, expense counts
 * - Low stock products
 * - Recent invoices
 *
 * This endpoint replaces the Zustand-based dashboard selectors that
 * operated on a truncated 100-item cache. It queries the database
 * directly for accurate counts and totals.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'company:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel for speed
    const [
      monthlyInvoices,
      monthlyExpenses,
      outstandingInvoices,
      overdueInvoices,
      customerCount,
      lowStockProducts,
      recentInvoices,
    ] = await Promise.all([
      // Monthly invoices (revenue)
      prisma.invoice.findMany({
        where: {
          companyId: companyId!,
          deletedAt: null,
          status: { not: 'CANCELLED' },
          issueDate: { gte: startOfMonth },
        },
        select: { total: true },
      }),
      // Monthly expenses
      prisma.expense.findMany({
        where: {
          companyId: companyId!,
          deletedAt: null,
          date: { gte: startOfMonth },
        },
        select: { amount: true },
      }),
      // Outstanding invoices (non-zero balance)
      prisma.invoice.findMany({
        where: {
          companyId: companyId!,
          deletedAt: null,
          status: { in: ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'] },
          balance: { gt: 0 },
        },
        select: { balance: true },
      }),
      // Overdue invoices
      prisma.invoice.count({
        where: {
          companyId: companyId!,
          deletedAt: null,
          status: 'OVERDUE',
        },
      }),
      // Customer count
      prisma.customer.count({
        where: {
          companyId: companyId!,
          deletedAt: null,
        },
      }),
      // Low stock products
      prisma.product.findMany({
        where: {
          companyId: companyId!,
          deletedAt: null,
          isActive: true,
          // quantity <= reorderLevel (Prisma doesn't support cross-column comparison)
          // Use raw query or fetch and filter
        },
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          reorderLevel: true,
        },
        orderBy: { quantity: 'asc' },
        take: 50,
      }),
      // Recent invoices
      prisma.invoice.findMany({
        where: {
          companyId: companyId!,
          deletedAt: null,
        },
        include: {
          customer: { select: { id: true, name: true } },
        },
        orderBy: { issueDate: 'desc' },
        take: 5,
      }),
    ]);

    // Calculate totals
    const totalRevenue = monthlyInvoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0
    );
    const totalExpenses = monthlyExpenses.reduce(
      (sum, exp) => sum + Number(exp.amount),
      0
    );
    const totalReceivable = outstandingInvoices.reduce(
      (sum, inv) => sum + Number(inv.balance),
      0
    );

    // Filter low stock (quantity <= reorderLevel) — can't do cross-column in Prisma where
    const lowStock = lowStockProducts.filter(
      (p) => p.quantity <= p.reorderLevel
    );

    return NextResponse.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      profit: Math.round((totalRevenue - totalExpenses) * 100) / 100,
      totalReceivable: Math.round(totalReceivable * 100) / 100,
      overdueCount: overdueInvoices,
      invoiceCount: monthlyInvoices.length,
      expenseCount: monthlyExpenses.length,
      customerCount,
      lowStockCount: lowStock.length,
      lowStockProducts: lowStock.slice(0, 10).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
        reorderLevel: p.reorderLevel,
      })),
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status.toLowerCase(),
        total: Number(inv.total),
        issueDate: inv.issueDate.toISOString(),
        customer: inv.customer ? { id: inv.customer.id, name: inv.customer.name } : null,
      })),
    });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to fetch dashboard stats'
    );
  }
}
