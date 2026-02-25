/**
 * GET /api/v1/reports/trial-balance
 * Generate a Trial Balance report.
 * - Queries all GL accounts with non-zero balances
 * - Groups by account type (Asset, Liability, Equity, Income, Expense)
 * - Calculates period debits/credits from journal lines
 * - Verifies total debits = total credits
 * - Supports as-of date and comparative periods
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get('asOfDate');
    const compareDate = searchParams.get('compareDate'); // optional comparative period

    if (!asOfDate) {
      return badRequest('asOfDate query parameter is required');
    }

    const asOf = new Date(asOfDate);
    if (isNaN(asOf.getTime())) {
      return badRequest('Invalid asOfDate format');
    }

    // Build the main trial balance
    const trialBalance = await buildTrialBalance(companyId!, asOf);

    // Build comparative period if requested
    let comparison = null;
    if (compareDate) {
      const compare = new Date(compareDate);
      if (!isNaN(compare.getTime())) {
        comparison = await buildTrialBalance(companyId!, compare);
      }
    }

    // Verify balance
    const totalDebits = trialBalance.reduce((sum, a) => sum + Number(a.debitBalance || 0), 0);
    const totalCredits = trialBalance.reduce((sum, a) => sum + Number(a.creditBalance || 0), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    // Group by account type
    const grouped = groupByAccountType(trialBalance);

    return NextResponse.json({
      asOfDate: asOf.toISOString(),
      compareDate: comparison ? compareDate : null,
      accounts: trialBalance,
      grouped,
      comparison: comparison ? groupByAccountType(comparison) : null,
      totals: {
        totalDebits: round2(totalDebits),
        totalCredits: round2(totalCredits),
        isBalanced,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate trial balance');
  }
}

interface TrialBalanceRow {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  subType: string | null;
  normalBalance: string | null;
  periodDebits: number;
  periodCredits: number;
  debitBalance: number;
  creditBalance: number;
}

async function buildTrialBalance(companyId: string, asOfDate: Date): Promise<TrialBalanceRow[]> {
  // Get all active GL accounts for the company
  const accounts = await prisma.gLAccount.findMany({
    where: { companyId, isActive: true, isHeader: false },
    select: {
      id: true,
      accountNumber: true,
      name: true,
      type: true,
      subType: true,
      normalBalance: true,
    },
    orderBy: { accountNumber: 'asc' },
  });

  // Aggregate debits and credits from journal lines for posted entries up to asOfDate
  const aggregates = await prisma.journalLine.groupBy({
    by: ['accountId'],
    _sum: {
      debitAmount: true,
      creditAmount: true,
    },
    where: {
      journalEntry: {
        companyId,
        status: 'POSTED',
        date: { lte: asOfDate },
      },
    },
  });

  // Build a lookup map
  const aggregateMap = new Map<string, { debits: number; credits: number }>();
  for (const agg of aggregates) {
    aggregateMap.set(agg.accountId, {
      debits: Number(agg._sum.debitAmount ?? 0),
      credits: Number(agg._sum.creditAmount ?? 0),
    });
  }

  // Build trial balance rows
  const rows: TrialBalanceRow[] = [];
  for (const account of accounts) {
    const agg = aggregateMap.get(account.id);
    const periodDebits = agg?.debits ?? 0;
    const periodCredits = agg?.credits ?? 0;
    const netBalance = periodDebits - periodCredits;

    // Skip accounts with zero activity
    if (Math.abs(netBalance) < 0.001 && periodDebits === 0 && periodCredits === 0) {
      continue;
    }

    // Determine debit/credit column based on normal balance
    let debitBalance = 0;
    let creditBalance = 0;

    if (netBalance > 0) {
      debitBalance = netBalance;
    } else if (netBalance < 0) {
      creditBalance = Math.abs(netBalance);
    }

    rows.push({
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.name,
      accountType: account.type,
      subType: account.subType,
      normalBalance: account.normalBalance,
      periodDebits: round2(periodDebits),
      periodCredits: round2(periodCredits),
      debitBalance: round2(debitBalance),
      creditBalance: round2(creditBalance),
    });
  }

  return rows;
}

function groupByAccountType(rows: TrialBalanceRow[]) {
  const groups: Record<string, { accounts: TrialBalanceRow[]; totalDebits: number; totalCredits: number }> = {};
  const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

  for (const type of typeOrder) {
    groups[type] = { accounts: [], totalDebits: 0, totalCredits: 0 };
  }

  for (const row of rows) {
    const group = groups[row.accountType] ?? { accounts: [], totalDebits: 0, totalCredits: 0 };
    group.accounts.push(row);
    group.totalDebits += row.debitBalance;
    group.totalCredits += row.creditBalance;
    if (!groups[row.accountType]) {
      groups[row.accountType] = group;
    }
  }

  // Round totals
  for (const key of Object.keys(groups)) {
    groups[key].totalDebits = round2(groups[key].totalDebits);
    groups[key].totalCredits = round2(groups[key].totalCredits);
  }

  return groups;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
