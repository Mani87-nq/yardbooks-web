/**
 * GET /api/v1/reports/profit-loss
 *
 * Generates a Profit & Loss (Income Statement) report.
 * Queries journal lines to aggregate INCOME and EXPENSE accounts
 * for a given date range.
 *
 * Query params:
 *   startDate — Start of reporting period (required)
 *   endDate   — End of reporting period (required)
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

    if (!startDateStr || !endDateStr) {
      return badRequest('startDate and endDate are required');
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return badRequest('Invalid date format');
    }

    // Query all journal lines for INCOME and EXPENSE accounts in the date range
    const journalLines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          companyId: companyId!,
          date: { gte: startDate, lte: endDate },
          status: 'POSTED',
        },
        account: {
          type: { in: ['INCOME', 'EXPENSE'] },
        },
      },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            name: true,
            type: true,
            subType: true,
          },
        },
      },
    });

    // Aggregate by account
    const accountTotals = new Map<string, {
      accountNumber: string;
      name: string;
      type: string;
      subType: string | null;
      debits: number;
      credits: number;
      balance: number;
    }>();

    for (const line of journalLines) {
      const key = line.account.id;
      const existing = accountTotals.get(key) ?? {
        accountNumber: line.account.accountNumber,
        name: line.account.name,
        type: line.account.type,
        subType: line.account.subType,
        debits: 0,
        credits: 0,
        balance: 0,
      };

      existing.debits += Number(line.debitAmount);
      existing.credits += Number(line.creditAmount);

      // Income accounts have credit normal balance (credits increase, debits decrease)
      // Expense accounts have debit normal balance (debits increase, credits decrease)
      if (line.account.type === 'INCOME') {
        existing.balance = existing.credits - existing.debits;
      } else {
        existing.balance = existing.debits - existing.credits;
      }

      accountTotals.set(key, existing);
    }

    // Separate into income and expense sections
    const incomeAccounts = Array.from(accountTotals.values())
      .filter((a) => a.type === 'INCOME')
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    const expenseAccounts = Array.from(accountTotals.values())
      .filter((a) => a.type === 'EXPENSE')
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    // Further break down expenses
    const cogsAccounts = expenseAccounts.filter((a) => a.subType === 'COGS');
    const operatingAccounts = expenseAccounts.filter((a) => a.subType === 'OPERATING' || !a.subType);
    const otherExpenseAccounts = expenseAccounts.filter((a) => a.subType === 'OTHER');

    // Calculate totals
    const totalRevenue = incomeAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalCogs = cogsAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalOperatingExpenses = operatingAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const operatingIncome = grossProfit - totalOperatingExpenses;
    const totalOtherExpenses = otherExpenseAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const netIncome = operatingIncome - totalOtherExpenses;

    return NextResponse.json({
      report: 'Profit & Loss Statement',
      period: { startDate: startDateStr, endDate: endDateStr },
      currency: 'JMD',
      sections: {
        revenue: {
          label: 'Revenue',
          accounts: incomeAccounts,
          total: totalRevenue,
        },
        costOfGoodsSold: {
          label: 'Cost of Goods Sold',
          accounts: cogsAccounts,
          total: totalCogs,
        },
        grossProfit: {
          label: 'Gross Profit',
          total: grossProfit,
        },
        operatingExpenses: {
          label: 'Operating Expenses',
          accounts: operatingAccounts,
          total: totalOperatingExpenses,
        },
        operatingIncome: {
          label: 'Operating Income',
          total: operatingIncome,
        },
        otherExpenses: {
          label: 'Other Income / Expenses',
          accounts: otherExpenseAccounts,
          total: totalOtherExpenses,
        },
        netIncome: {
          label: 'Net Income',
          total: netIncome,
        },
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate P&L report');
  }
}
