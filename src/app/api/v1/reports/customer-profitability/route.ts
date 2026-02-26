/**
 * GET /api/v1/reports/customer-profitability — Customer Profitability Analysis
 *
 * Ranks customers by profitability: revenue from invoices minus allocated COGS.
 * Shows each customer's revenue contribution, margins, and payment behavior.
 *
 * Query params:
 *   startDate — Start of reporting period (required)
 *   endDate   — End of reporting period (required)
 *   limit     — Max customers to return (optional, default 50)
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const limitStr = searchParams.get('limit');

    if (!startDateStr || !endDateStr) {
      return badRequest('startDate and endDate are required');
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const limit = Math.min(parseInt(limitStr || '50', 10) || 50, 200);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return badRequest('Invalid date format');
    }
    endDate.setHours(23, 59, 59, 999);

    // ── 1. Get all invoices with line items in period ──
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: companyId!,
        issueDate: { gte: startDate, lte: endDate },
        status: { in: ['SENT', 'PARTIAL', 'PAID', 'OVERDUE'] },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                costPrice: true,
              },
            },
          },
        },
      },
    });

    // ── 2. Aggregate by customer ──
    const customerMap = new Map<string, {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      revenue: number;
      cogs: number;
      gctCollected: number;
      discountsGiven: number;
      invoiceCount: number;
      paidInvoices: number;
      overdueInvoices: number;
      outstandingBalance: number;
      avgInvoiceValue: number;
      firstInvoiceDate: Date | null;
      lastInvoiceDate: Date | null;
    }>();

    for (const inv of invoices) {
      if (!inv.customer) continue;

      const custId = inv.customer.id;
      const existing = customerMap.get(custId) ?? {
        id: inv.customer.id,
        name: inv.customer.name,
        email: inv.customer.email,
        phone: inv.customer.phone,
        revenue: 0,
        cogs: 0,
        gctCollected: 0,
        discountsGiven: 0,
        invoiceCount: 0,
        paidInvoices: 0,
        overdueInvoices: 0,
        outstandingBalance: 0,
        avgInvoiceValue: 0,
        firstInvoiceDate: null,
        lastInvoiceDate: null,
      };

      // Revenue (subtotal before tax)
      const subtotal = Number(inv.subtotal || 0);
      const tax = Number(inv.gctAmount || 0);
      const total = Number(inv.total || 0);
      const discount = Number(inv.discount || 0);

      existing.revenue += subtotal;
      existing.gctCollected += tax;
      existing.discountsGiven += discount;
      existing.invoiceCount += 1;

      if (inv.status === 'PAID') {
        existing.paidInvoices += 1;
      } else if (inv.status === 'OVERDUE') {
        existing.overdueInvoices += 1;
        existing.outstandingBalance += total - Number(inv.amountPaid || 0);
      } else if (inv.status === 'SENT' || inv.status === 'PARTIAL') {
        existing.outstandingBalance += total - Number(inv.amountPaid || 0);
      }

      // COGS from line items
      for (const item of inv.items) {
        if (item.product?.costPrice) {
          existing.cogs += Number(item.product.costPrice) * Number(item.quantity);
        }
      }

      // Date tracking
      const invDate = new Date(inv.issueDate);
      if (!existing.firstInvoiceDate || invDate < existing.firstInvoiceDate) {
        existing.firstInvoiceDate = invDate;
      }
      if (!existing.lastInvoiceDate || invDate > existing.lastInvoiceDate) {
        existing.lastInvoiceDate = invDate;
      }

      customerMap.set(custId, existing);
    }

    // ── 3. Calculate profitability metrics ──
    const totalCompanyRevenue = Array.from(customerMap.values())
      .reduce((sum, c) => sum + c.revenue, 0);

    const customers = Array.from(customerMap.values())
      .map(c => {
        const grossProfit = c.revenue - c.cogs;
        const grossMargin = c.revenue > 0 ? (grossProfit / c.revenue) * 100 : 0;
        const revenueShare = totalCompanyRevenue > 0 ? (c.revenue / totalCompanyRevenue) * 100 : 0;
        const avgInvoiceValue = c.invoiceCount > 0 ? c.revenue / c.invoiceCount : 0;
        const paymentRate = c.invoiceCount > 0 ? (c.paidInvoices / c.invoiceCount) * 100 : 0;

        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          revenue: round2(c.revenue),
          cogs: round2(c.cogs),
          grossProfit: round2(grossProfit),
          grossMargin: round2(grossMargin),
          revenueShare: round2(revenueShare),
          gctCollected: round2(c.gctCollected),
          discountsGiven: round2(c.discountsGiven),
          invoiceCount: c.invoiceCount,
          avgInvoiceValue: round2(avgInvoiceValue),
          paidInvoices: c.paidInvoices,
          overdueInvoices: c.overdueInvoices,
          outstandingBalance: round2(c.outstandingBalance),
          paymentRate: round2(paymentRate),
          firstInvoiceDate: c.firstInvoiceDate?.toISOString().split('T')[0] ?? null,
          lastInvoiceDate: c.lastInvoiceDate?.toISOString().split('T')[0] ?? null,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit) // Most profitable first
      .slice(0, limit);

    // ── 4. Summary statistics ──
    const allCustomers = Array.from(customerMap.values());
    const summary = {
      totalCustomers: allCustomers.length,
      totalRevenue: round2(totalCompanyRevenue),
      totalCOGS: round2(allCustomers.reduce((s, c) => s + c.cogs, 0)),
      totalGrossProfit: round2(allCustomers.reduce((s, c) => s + (c.revenue - c.cogs), 0)),
      avgGrossMargin: totalCompanyRevenue > 0
        ? round2(((totalCompanyRevenue - allCustomers.reduce((s, c) => s + c.cogs, 0)) / totalCompanyRevenue) * 100)
        : 0,
      totalOutstanding: round2(allCustomers.reduce((s, c) => s + c.outstandingBalance, 0)),
      // Top 20% of customers by revenue (Pareto)
      top20PercentRevenue: (() => {
        const sorted = [...allCustomers].sort((a, b) => b.revenue - a.revenue);
        const top20Count = Math.max(1, Math.ceil(sorted.length * 0.2));
        const top20Revenue = sorted.slice(0, top20Count).reduce((s, c) => s + c.revenue, 0);
        return round2(totalCompanyRevenue > 0 ? (top20Revenue / totalCompanyRevenue) * 100 : 0);
      })(),
    };

    return NextResponse.json({
      report: 'Customer Profitability Analysis',
      period: { startDate: startDateStr, endDate: endDateStr },
      currency: 'JMD',
      summary,
      customers,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate customer profitability report');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
