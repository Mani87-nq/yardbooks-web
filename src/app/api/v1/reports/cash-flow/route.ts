/**
 * GET /api/v1/reports/cash-flow
 * Cash Flow Statement (Indirect Method).
 * - Start with net income
 * - Operating: Adjust for non-cash items (depreciation, accruals)
 * - Investing: Fixed asset purchases/disposals
 * - Financing: Loan proceeds/repayments, equity changes
 * - Uses GL account type mappings for classification
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return badRequest('startDate and endDate query parameters are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return badRequest('Invalid date format');
    }

    // Get all GL accounts for the company
    const accounts = await prisma.gLAccount.findMany({
      where: { companyId, isActive: true, isHeader: false },
      select: {
        id: true,
        accountNumber: true,
        name: true,
        type: true,
        subType: true,
        isBankAccount: true,
      },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    // Get all journal line aggregates for the period grouped by account
    const periodAggregates = await prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debitAmount: true, creditAmount: true },
      where: {
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: { gte: start, lte: end },
        },
      },
    });

    // Also get prior-period aggregates (for balance sheet changes)
    const priorAggregates = await prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debitAmount: true, creditAmount: true },
      where: {
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: { lt: start },
        },
      },
    });

    const endAggregates = await prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debitAmount: true, creditAmount: true },
      where: {
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: { lte: end },
        },
      },
    });

    // Helper to compute net balance (debits - credits)
    const periodNet = new Map<string, number>();
    for (const agg of periodAggregates) {
      periodNet.set(agg.accountId, Number(agg._sum.debitAmount ?? 0) - Number(agg._sum.creditAmount ?? 0));
    }

    const priorBalanceMap = new Map<string, number>();
    for (const agg of priorAggregates) {
      priorBalanceMap.set(agg.accountId, Number(agg._sum.debitAmount ?? 0) - Number(agg._sum.creditAmount ?? 0));
    }

    const endBalanceMap = new Map<string, number>();
    for (const agg of endAggregates) {
      endBalanceMap.set(agg.accountId, Number(agg._sum.debitAmount ?? 0) - Number(agg._sum.creditAmount ?? 0));
    }

    // ---- CALCULATE NET INCOME ----
    // Net Income = Total Income Credits - Total Expense Debits
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const [accountId, net] of periodNet) {
      const account = accountMap.get(accountId);
      if (!account) continue;

      if (account.type === 'INCOME') {
        // Income accounts have credit normal balance, so net is negative when there's income
        totalIncome += -net; // flip sign: credits are positive income
      } else if (account.type === 'EXPENSE') {
        totalExpenses += net; // expenses are debit normal
      }
    }

    const netIncome = totalIncome - totalExpenses;

    // ---- OPERATING ACTIVITIES (Indirect Method) ----
    const operatingAdjustments: CashFlowItem[] = [];

    // Changes in current assets and liabilities (working capital changes)
    for (const account of accounts) {
      if (account.type === 'ASSET' && account.subType === 'CURRENT' && !account.isBankAccount) {
        // Increase in current asset = cash outflow (negative adjustment)
        const change = (endBalanceMap.get(account.id) ?? 0) - (priorBalanceMap.get(account.id) ?? 0);
        if (Math.abs(change) > 0.01) {
          operatingAdjustments.push({
            accountId: account.id,
            accountNumber: account.accountNumber,
            accountName: account.name,
            description: `Change in ${account.name}`,
            amount: round2(-change), // Increase in asset = negative cash flow
          });
        }
      } else if (account.type === 'LIABILITY' && account.subType === 'CURRENT') {
        // Increase in current liability = cash inflow (positive adjustment)
        const change = (endBalanceMap.get(account.id) ?? 0) - (priorBalanceMap.get(account.id) ?? 0);
        if (Math.abs(change) > 0.01) {
          operatingAdjustments.push({
            accountId: account.id,
            accountNumber: account.accountNumber,
            accountName: account.name,
            description: `Change in ${account.name}`,
            amount: round2(change), // Credits increase liability, which is cash inflow
          });
        }
      }
    }

    // Add back depreciation (non-cash expense)
    // Look for accounts that have "depreciation" in the name
    for (const account of accounts) {
      if (account.type === 'EXPENSE' && account.name.toLowerCase().includes('depreciation')) {
        const net = periodNet.get(account.id) ?? 0;
        if (Math.abs(net) > 0.01) {
          operatingAdjustments.push({
            accountId: account.id,
            accountNumber: account.accountNumber,
            accountName: account.name,
            description: `Add back: ${account.name}`,
            amount: round2(net), // Add back non-cash expense
          });
        }
      }
    }

    const operatingTotal = round2(netIncome + operatingAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0));

    // ---- INVESTING ACTIVITIES ----
    const investingItems: CashFlowItem[] = [];

    for (const account of accounts) {
      if (account.type === 'ASSET' && account.subType === 'NON_CURRENT') {
        const change = (endBalanceMap.get(account.id) ?? 0) - (priorBalanceMap.get(account.id) ?? 0);
        if (Math.abs(change) > 0.01) {
          investingItems.push({
            accountId: account.id,
            accountNumber: account.accountNumber,
            accountName: account.name,
            description: change > 0 ? `Purchase of ${account.name}` : `Disposal of ${account.name}`,
            amount: round2(-change), // Increase in asset = cash outflow
          });
        }
      }
    }

    const investingTotal = round2(investingItems.reduce((sum, a) => sum + Number(a.amount || 0), 0));

    // ---- FINANCING ACTIVITIES ----
    const financingItems: CashFlowItem[] = [];

    for (const account of accounts) {
      if (account.type === 'LIABILITY' && account.subType === 'NON_CURRENT') {
        const change = (endBalanceMap.get(account.id) ?? 0) - (priorBalanceMap.get(account.id) ?? 0);
        if (Math.abs(change) > 0.01) {
          financingItems.push({
            accountId: account.id,
            accountNumber: account.accountNumber,
            accountName: account.name,
            description: change < 0 ? `Loan repayment: ${account.name}` : `Loan proceeds: ${account.name}`,
            amount: round2(change), // Increase in liability = cash inflow
          });
        }
      } else if (account.type === 'EQUITY') {
        const change = (endBalanceMap.get(account.id) ?? 0) - (priorBalanceMap.get(account.id) ?? 0);
        // Exclude retained earnings (handled by net income)
        if (Math.abs(change) > 0.01 && !account.name.toLowerCase().includes('retained')) {
          financingItems.push({
            accountId: account.id,
            accountNumber: account.accountNumber,
            accountName: account.name,
            description: `Change in ${account.name}`,
            amount: round2(change),
          });
        }
      }
    }

    const financingTotal = round2(financingItems.reduce((sum, a) => sum + Number(a.amount || 0), 0));

    // ---- CASH SUMMARY ----
    const netCashChange = round2(operatingTotal + investingTotal + financingTotal);

    // Calculate opening and closing cash (bank accounts / cash accounts)
    const cashAccounts = accounts.filter((a) => a.isBankAccount || a.name.toLowerCase().includes('cash'));
    const openingCash = round2(cashAccounts.reduce((sum, a) => sum + Number(priorBalanceMap.get(a.id) ?? 0), 0));
    const closingCash = round2(openingCash + netCashChange);

    return NextResponse.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      netIncome: round2(netIncome),
      operating: {
        netIncome: round2(netIncome),
        adjustments: operatingAdjustments,
        total: operatingTotal,
      },
      investing: {
        items: investingItems,
        total: investingTotal,
      },
      financing: {
        items: financingItems,
        total: financingTotal,
      },
      summary: {
        netCashChange,
        openingCash,
        closingCash,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate cash flow statement');
  }
}

interface CashFlowItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  description: string;
  amount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
