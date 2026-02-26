/**
 * GET /api/v1/reports/budget-vs-actual — Budget vs Actual variance report
 *
 * Compares budgeted amounts against actual GL activity for each account
 * in a fiscal year. Shows monthly and YTD variance.
 *
 * Query params:
 *   - fiscalYear: required (e.g., 2026)
 *   - month: optional (1-12) — if provided, shows actuals up to that month
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'gl:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const fiscalYearStr = searchParams.get('fiscalYear');
    const monthStr = searchParams.get('month');

    if (!fiscalYearStr) return badRequest('fiscalYear is required');
    const fiscalYear = parseInt(fiscalYearStr);
    if (isNaN(fiscalYear)) return badRequest('Invalid fiscalYear');

    const throughMonth = monthStr ? parseInt(monthStr) : 12; // Default to full year
    if (throughMonth < 1 || throughMonth > 12) return badRequest('month must be 1-12');

    // Get the budget for this fiscal year
    const budget = await prisma.budget.findUnique({
      where: { companyId_fiscalYear: { companyId: companyId!, fiscalYear } },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, accountNumber: true, name: true, type: true },
            },
          },
        },
      },
    });

    if (!budget) {
      return notFound(`No budget found for fiscal year ${fiscalYear}`);
    }

    // Get the company's fiscal year end to determine period dates
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { fiscalYearEnd: true },
    });
    const fyEndMonth = company?.fiscalYearEnd ?? 3; // Default: March

    // Calculate fiscal year start date
    // If FY ends in March, FY 2026 starts April 2025 and ends March 2026
    // Month 1 of the budget = April = fyEndMonth + 1
    const fyStartMonth = (fyEndMonth % 12); // 0-indexed: March = 2, so start = 3 (April)
    const fyStartYear = fiscalYear - 1; // FY 2026 starts in calendar year 2025 for Jamaica

    // Jamaica FY: April of previous year to March of fiscal year
    const fiscalYearStart = new Date(fyStartYear, fyStartMonth + 1 - 1, 1); // April 1

    // Calculate the end date based on throughMonth
    const endMonthOffset = fyStartMonth + throughMonth;
    const endYear = fyStartYear + Math.floor(endMonthOffset / 12);
    const endMonth = endMonthOffset % 12;
    const periodEnd = new Date(endYear, endMonth + 1, 0); // Last day of the month

    // Get actual GL amounts for each budgeted account
    const accountIds = budget.lines.map((l) => l.accountId);

    // Query actual journal line totals grouped by account and month
    const journalLines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          companyId: companyId!,
          date: { gte: fiscalYearStart, lte: periodEnd },
          status: 'POSTED',
        },
        accountId: { in: accountIds },
      },
      select: {
        accountId: true,
        debitAmount: true,
        creditAmount: true,
        journalEntry: { select: { date: true } },
      },
    });

    // Build actual amounts per account per fiscal month
    const actualsByAccount = new Map<string, Record<number, number>>();

    for (const line of journalLines) {
      const entryDate = new Date(line.journalEntry.date);
      // Determine which fiscal month this falls into (1-12)
      let fiscalMonth = (entryDate.getMonth() - fyStartMonth) % 12;
      if (fiscalMonth < 0) fiscalMonth += 12;
      fiscalMonth += 1; // 1-indexed

      if (!actualsByAccount.has(line.accountId)) {
        actualsByAccount.set(line.accountId, {});
      }
      const months = actualsByAccount.get(line.accountId)!;

      // For expense/asset accounts: debit increases, credit decreases
      // For income/liability/equity accounts: credit increases, debit decreases
      const debit = Number(line.debitAmount ?? 0);
      const credit = Number(line.creditAmount ?? 0);
      const netAmount = debit - credit; // Positive for expense accounts

      months[fiscalMonth] = (months[fiscalMonth] ?? 0) + netAmount;
    }

    // Build report lines
    const reportLines = budget.lines.map((budgetLine) => {
      const actuals = actualsByAccount.get(budgetLine.accountId) ?? {};

      // Calculate budget and actual totals through the specified month
      let budgetTotal = 0;
      let actualTotal = 0;
      const monthlyData: Array<{
        month: number;
        budget: number;
        actual: number;
        variance: number;
        variancePercent: number | null;
      }> = [];

      for (let m = 1; m <= throughMonth; m++) {
        const budgetAmount = Number((budgetLine as any)[`month${m}`] ?? 0);
        const actualAmount = Math.round((actuals[m] ?? 0) * 100) / 100;
        const variance = budgetAmount - actualAmount;
        const variancePercent = budgetAmount !== 0
          ? Math.round((variance / budgetAmount) * 10000) / 100
          : null;

        budgetTotal += budgetAmount;
        actualTotal += actualAmount;

        monthlyData.push({
          month: m,
          budget: budgetAmount,
          actual: actualAmount,
          variance: Math.round(variance * 100) / 100,
          variancePercent,
        });
      }

      const ytdVariance = Math.round((budgetTotal - actualTotal) * 100) / 100;
      const ytdVariancePercent = budgetTotal !== 0
        ? Math.round(((budgetTotal - actualTotal) / budgetTotal) * 10000) / 100
        : null;

      return {
        accountId: budgetLine.accountId,
        accountNumber: budgetLine.account.accountNumber,
        accountName: budgetLine.account.name,
        accountType: budgetLine.account.type,
        months: monthlyData,
        ytd: {
          budget: Math.round(budgetTotal * 100) / 100,
          actual: Math.round(actualTotal * 100) / 100,
          variance: ytdVariance,
          variancePercent: ytdVariancePercent,
        },
      };
    });

    // Sort by account number
    reportLines.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    // Grand totals
    const grandBudget = reportLines.reduce((sum, l) => sum + l.ytd.budget, 0);
    const grandActual = reportLines.reduce((sum, l) => sum + l.ytd.actual, 0);

    return NextResponse.json({
      report: 'Budget vs Actual',
      fiscalYear,
      budgetName: budget.name,
      throughMonth,
      generatedAt: new Date().toISOString(),
      lines: reportLines,
      totals: {
        budget: Math.round(grandBudget * 100) / 100,
        actual: Math.round(grandActual * 100) / 100,
        variance: Math.round((grandBudget - grandActual) * 100) / 100,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate budget vs actual report');
  }
}
