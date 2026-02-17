/**
 * GET /api/v1/exports/gct-4a
 * Generate GCT 4A Return for Jamaica Tax Administration (TAJ).
 * - Aggregates output tax by rate (15%, 25%, 10%, 0%)
 * - Aggregates input tax credits with restrictions
 * - Applies 50% restrictions on entertainment/vehicle/restaurant
 * - Handles capital goods > JMD 100K (24-month recovery)
 * - Calculates net GCT payable/refundable
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import {
  GCT_RATES,
  RESTRICTED_CATEGORIES,
  CAPITAL_GOODS_THRESHOLD,
  calculateClaimableCredit,
} from '@/lib/tax/gct-input-credit';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'tax:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    if (!periodStart || !periodEnd) {
      return badRequest('periodStart and periodEnd are required');
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return badRequest('Invalid date format');
    }

    // ---- OUTPUT TAX (Sales) ----
    // Get all invoices in the period
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: companyId!,
        deletedAt: null,
        issueDate: { gte: start, lte: end },
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      include: {
        items: true,
      },
    });

    // Aggregate output tax by rate
    const outputByRate: Record<string, { sales: number; gctCollected: number; count: number }> = {
      STANDARD: { sales: 0, gctCollected: 0, count: 0 },
      TELECOM: { sales: 0, gctCollected: 0, count: 0 },
      TOURISM: { sales: 0, gctCollected: 0, count: 0 },
      ZERO_RATED: { sales: 0, gctCollected: 0, count: 0 },
      EXEMPT: { sales: 0, gctCollected: 0, count: 0 },
    };

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const rate = item.gctRate || 'STANDARD';
        const group = outputByRate[rate];
        if (group) {
          group.sales += Number(item.total) - Number(item.gctAmount);
          group.gctCollected += Number(item.gctAmount);
          group.count++;
        }
      }
    }

    const totalOutputTax = Object.values(outputByRate).reduce((sum, g) => sum + g.gctCollected, 0);
    const totalSales = Object.values(outputByRate).reduce((sum, g) => sum + g.sales, 0);

    // ---- INPUT TAX (Purchases/Expenses) ----
    const expenses = await prisma.expense.findMany({
      where: {
        companyId: companyId!,
        deletedAt: null,
        date: { gte: start, lte: end },
        gctClaimable: true,
      },
    });

    // Track restricted and unrestricted input credits
    let totalInputTax = 0;
    let totalClaimableInput = 0;
    let totalRestricted = 0;
    const restrictedItems: Array<{
      description: string;
      category: string;
      gctAmount: number;
      claimable: number;
      restriction: string;
    }> = [];

    for (const expense of expenses) {
      const gctAmount = Number(expense.gctAmount);
      if (gctAmount <= 0) continue;

      totalInputTax += gctAmount;

      const isCapital = Number(expense.amount) > CAPITAL_GOODS_THRESHOLD;
      const result = calculateClaimableCredit({
        gctAmount,
        category: expense.category,
        isCapitalGood: isCapital,
        totalAmount: Number(expense.amount),
      });

      totalClaimableInput += result.claimableAmount;

      if (result.restrictionApplied !== 'none') {
        totalRestricted += gctAmount - result.claimableAmount;
        restrictedItems.push({
          description: expense.description,
          category: expense.category,
          gctAmount: round2(gctAmount),
          claimable: result.claimableAmount,
          restriction: result.restrictionApplied,
        });
      }
    }

    // ---- NET GCT ----
    const netGCT = round2(totalOutputTax - totalClaimableInput);
    const isPayable = netGCT > 0;

    // ---- GCT 4A FORMAT ----
    const gct4a = {
      header: {
        formType: 'GCT-4A',
        taxPeriod: { start: start.toISOString(), end: end.toISOString() },
        companyId: companyId!,
        generatedAt: new Date().toISOString(),
      },

      // Part 1: Output Tax
      outputTax: {
        standardRate: {
          rate: GCT_RATES.STANDARD,
          taxableSales: round2(outputByRate.STANDARD.sales),
          gctCollected: round2(outputByRate.STANDARD.gctCollected),
        },
        telecomRate: {
          rate: GCT_RATES.TELECOM,
          taxableSales: round2(outputByRate.TELECOM.sales),
          gctCollected: round2(outputByRate.TELECOM.gctCollected),
        },
        tourismRate: {
          rate: GCT_RATES.TOURISM,
          taxableSales: round2(outputByRate.TOURISM.sales),
          gctCollected: round2(outputByRate.TOURISM.gctCollected),
        },
        zeroRated: {
          rate: 0,
          taxableSales: round2(outputByRate.ZERO_RATED.sales),
          gctCollected: 0,
        },
        exempt: {
          taxableSales: round2(outputByRate.EXEMPT.sales),
          gctCollected: 0,
        },
        totalSales: round2(totalSales),
        totalOutputTax: round2(totalOutputTax),
      },

      // Part 2: Input Tax Credits
      inputTax: {
        totalInputTax: round2(totalInputTax),
        totalClaimable: round2(totalClaimableInput),
        totalRestricted: round2(totalRestricted),
        restrictionDetails: restrictedItems,
      },

      // Part 3: Net GCT
      summary: {
        outputTax: round2(totalOutputTax),
        inputTaxCredit: round2(totalClaimableInput),
        netGCT: round2(netGCT),
        status: isPayable ? 'PAYABLE' : 'REFUNDABLE',
        invoiceCount: invoices.length,
        expenseCount: expenses.length,
      },
    };

    return NextResponse.json(gct4a);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate GCT 4A return');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
