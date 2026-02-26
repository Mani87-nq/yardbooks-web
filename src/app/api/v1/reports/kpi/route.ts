/**
 * GET /api/v1/reports/kpi — Key Performance Indicators dashboard
 *
 * Returns core financial KPIs for management decision-making:
 * - Revenue (current month + YTD)
 * - Gross margin %
 * - Net profit margin %
 * - Accounts receivable days (DSO)
 * - Accounts payable days (DPO)
 * - Current ratio
 * - Quick ratio
 * - Payroll cost as % of revenue
 * - Cash on hand
 * - Monthly burn rate
 * - MoM revenue growth
 *
 * Query params:
 *   asOfDate — optional, defaults to today
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';
import type { GLAccountType, GLAccountSubType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const asOfDateStr = searchParams.get('asOfDate');
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
    asOfDate.setHours(23, 59, 59, 999);

    // ── Date ranges ──
    const currentMonthStart = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);
    const prevMonthStart = new Date(asOfDate.getFullYear(), asOfDate.getMonth() - 1, 1);
    const prevMonthEnd = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 0, 23, 59, 59, 999);

    // Jamaica fiscal year: April 1 - March 31
    const fiscalYearStart = asOfDate.getMonth() >= 3 // April = month 3
      ? new Date(asOfDate.getFullYear(), 3, 1)
      : new Date(asOfDate.getFullYear() - 1, 3, 1);

    // ── Helper: sum journal lines by account type in date range ──
    async function sumByType(
      types: GLAccountType[],
      startDate: Date,
      endDate: Date,
      subTypes?: GLAccountSubType[],
    ): Promise<number> {
      const lines = await prisma.journalLine.findMany({
        where: {
          journalEntry: {
            companyId: companyId!,
            date: { gte: startDate, lte: endDate },
            status: 'POSTED',
          },
          account: {
            type: { in: types },
            ...(subTypes ? { subType: { in: subTypes } } : {}),
          },
        },
        select: { debitAmount: true, creditAmount: true, account: { select: { type: true } } },
      });

      let total = 0;
      for (const line of lines) {
        if (line.account.type === 'INCOME') {
          total += Number(line.creditAmount) - Number(line.debitAmount);
        } else {
          total += Number(line.debitAmount) - Number(line.creditAmount);
        }
      }
      return total;
    }

    // ── Helper: sum balance sheet account balances as of date ──
    async function balanceAsOf(
      types: GLAccountType[],
      endDate: Date,
      subTypes?: GLAccountSubType[],
      accountNumbers?: string[],
    ): Promise<number> {
      const lines = await prisma.journalLine.findMany({
        where: {
          journalEntry: {
            companyId: companyId!,
            date: { lte: endDate },
            status: 'POSTED',
          },
          account: {
            type: { in: types },
            ...(subTypes ? { subType: { in: subTypes } } : {}),
            ...(accountNumbers ? { accountNumber: { in: accountNumbers } } : {}),
          },
        },
        select: { debitAmount: true, creditAmount: true, account: { select: { type: true } } },
      });

      let total = 0;
      for (const line of lines) {
        if (line.account.type === 'ASSET') {
          total += Number(line.debitAmount) - Number(line.creditAmount);
        } else {
          // LIABILITY / EQUITY — credit normal
          total += Number(line.creditAmount) - Number(line.debitAmount);
        }
      }
      return total;
    }

    // ── Compute KPIs ──
    // 1. Revenue
    const revenueCurrentMonth = await sumByType(['INCOME'], currentMonthStart, asOfDate);
    const revenueYTD = await sumByType(['INCOME'], fiscalYearStart, asOfDate);
    const revenuePrevMonth = await sumByType(['INCOME'], prevMonthStart, prevMonthEnd);

    // 2. COGS
    const cogsCurrentMonth = await sumByType(['EXPENSE'], currentMonthStart, asOfDate, ['COGS']);
    const cogsYTD = await sumByType(['EXPENSE'], fiscalYearStart, asOfDate, ['COGS']);

    // 3. Total Expenses (for net profit)
    const totalExpensesCurrentMonth = await sumByType(['EXPENSE'], currentMonthStart, asOfDate);
    const totalExpensesYTD = await sumByType(['EXPENSE'], fiscalYearStart, asOfDate);

    // 4. Gross margin
    const grossProfitCurrentMonth = revenueCurrentMonth - cogsCurrentMonth;
    const grossMarginCurrentMonth = revenueCurrentMonth > 0
      ? (grossProfitCurrentMonth / revenueCurrentMonth) * 100 : 0;
    const grossProfitYTD = revenueYTD - cogsYTD;
    const grossMarginYTD = revenueYTD > 0
      ? (grossProfitYTD / revenueYTD) * 100 : 0;

    // 5. Net profit margin
    const netIncomeCurrentMonth = revenueCurrentMonth - totalExpensesCurrentMonth;
    const netMarginCurrentMonth = revenueCurrentMonth > 0
      ? (netIncomeCurrentMonth / revenueCurrentMonth) * 100 : 0;
    const netIncomeYTD = revenueYTD - totalExpensesYTD;
    const netMarginYTD = revenueYTD > 0
      ? (netIncomeYTD / revenueYTD) * 100 : 0;

    // 6. Balance sheet items
    const totalAR = await balanceAsOf(['ASSET'], asOfDate, undefined, ['1100']);
    const totalAP = await balanceAsOf(['LIABILITY'], asOfDate, undefined, ['2000']);
    const cashOnHand = await balanceAsOf(['ASSET'], asOfDate, undefined, ['1000', '1010', '1020']);
    const totalCurrentAssets = await balanceAsOf(['ASSET'], asOfDate, ['CURRENT']);
    const totalCurrentLiabilities = await balanceAsOf(['LIABILITY'], asOfDate, ['CURRENT']);
    const inventory = await balanceAsOf(['ASSET'], asOfDate, undefined, ['1200']);

    // 7. Liquidity ratios
    const currentRatio = totalCurrentLiabilities > 0
      ? totalCurrentAssets / totalCurrentLiabilities : null;
    const quickRatio = totalCurrentLiabilities > 0
      ? (totalCurrentAssets - inventory) / totalCurrentLiabilities : null;

    // 8. AR days (DSO) — based on YTD average daily revenue
    const daysSinceFYStart = Math.max(1, Math.ceil(
      (asOfDate.getTime() - fiscalYearStart.getTime()) / (1000 * 60 * 60 * 24)
    ));
    const avgDailyRevenue = revenueYTD / daysSinceFYStart;
    const arDays = avgDailyRevenue > 0 ? Math.round(totalAR / avgDailyRevenue) : null;

    // 9. AP days (DPO) — based on YTD average daily COGS
    const avgDailyCOGS = cogsYTD / daysSinceFYStart;
    const apDays = avgDailyCOGS > 0 ? Math.round(totalAP / avgDailyCOGS) : null;

    // 10. Payroll cost as % of revenue
    const payrollExpenseYTD = await sumByType(
      ['EXPENSE'], fiscalYearStart, asOfDate, ['OPERATING']
    );
    // Get just salary accounts
    const salaryLines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          companyId: companyId!,
          date: { gte: fiscalYearStart, lte: asOfDate },
          status: 'POSTED',
        },
        account: {
          accountNumber: { in: ['6110', '6120'] }, // Salaries + Employer payroll taxes
        },
      },
      select: { debitAmount: true, creditAmount: true },
    });
    let payrollCost = 0;
    for (const line of salaryLines) {
      payrollCost += Number(line.debitAmount) - Number(line.creditAmount);
    }
    const payrollPercentOfRevenue = revenueYTD > 0
      ? (payrollCost / revenueYTD) * 100 : 0;

    // 11. MoM revenue growth
    const revenueGrowthMoM = revenuePrevMonth > 0
      ? ((revenueCurrentMonth - revenuePrevMonth) / revenuePrevMonth) * 100
      : (revenueCurrentMonth > 0 ? 100 : 0);

    // 12. Monthly burn rate (average monthly expenses over last 3 months)
    const threeMonthsAgo = new Date(asOfDate.getFullYear(), asOfDate.getMonth() - 3, 1);
    const totalExpenses3M = await sumByType(['EXPENSE'], threeMonthsAgo, asOfDate);
    const monthlyBurnRate = totalExpenses3M / 3;
    const cashRunwayMonths = monthlyBurnRate > 0
      ? Math.round((cashOnHand / monthlyBurnRate) * 10) / 10 : null;

    // 13. Invoice counts
    const [totalInvoices, overdueInvoices, totalEmployees] = await Promise.all([
      prisma.invoice.count({
        where: {
          companyId: companyId!,
          status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
        },
      }),
      prisma.invoice.count({
        where: {
          companyId: companyId!,
          status: 'OVERDUE',
        },
      }),
      prisma.employee.count({
        where: {
          companyId: companyId!,
          isActive: true,
        },
      }),
    ]);

    return NextResponse.json({
      report: 'Key Performance Indicators',
      asOfDate: asOfDate.toISOString().split('T')[0],
      fiscalYearStart: fiscalYearStart.toISOString().split('T')[0],
      currency: 'JMD',
      kpis: {
        // Revenue
        revenueCurrentMonth: round2(revenueCurrentMonth),
        revenueYTD: round2(revenueYTD),
        revenuePrevMonth: round2(revenuePrevMonth),
        revenueGrowthMoM: round2(revenueGrowthMoM),

        // Profitability
        grossProfitCurrentMonth: round2(grossProfitCurrentMonth),
        grossMarginCurrentMonth: round2(grossMarginCurrentMonth),
        grossProfitYTD: round2(grossProfitYTD),
        grossMarginYTD: round2(grossMarginYTD),
        netIncomeCurrentMonth: round2(netIncomeCurrentMonth),
        netMarginCurrentMonth: round2(netMarginCurrentMonth),
        netIncomeYTD: round2(netIncomeYTD),
        netMarginYTD: round2(netMarginYTD),

        // Liquidity
        cashOnHand: round2(cashOnHand),
        currentRatio: currentRatio !== null ? round2(currentRatio) : null,
        quickRatio: quickRatio !== null ? round2(quickRatio) : null,
        cashRunwayMonths,

        // Efficiency
        arDays,
        apDays,
        totalAR: round2(totalAR),
        totalAP: round2(totalAP),

        // Payroll
        payrollCostYTD: round2(payrollCost),
        payrollPercentOfRevenue: round2(payrollPercentOfRevenue),
        totalEmployees,

        // Activity
        openInvoices: totalInvoices,
        overdueInvoices,
        monthlyBurnRate: round2(monthlyBurnRate),
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate KPI report');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
