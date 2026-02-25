/**
 * GET /api/v1/reports/balance-sheet
 *
 * Generates a Balance Sheet report as of a specific date.
 * Queries journal lines to aggregate ASSET, LIABILITY, and EQUITY accounts.
 *
 * Balance Sheet equation: Assets = Liabilities + Equity
 *
 * Query params:
 *   asOfDate — The date for the balance sheet snapshot (required)
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
    const asOfDateStr = searchParams.get('asOfDate');

    if (!asOfDateStr) {
      return badRequest('asOfDate is required');
    }

    const asOfDate = new Date(asOfDateStr);
    if (isNaN(asOfDate.getTime())) {
      return badRequest('Invalid date format');
    }

    // Set to end of day
    asOfDate.setHours(23, 59, 59, 999);

    // Query all journal lines up to the asOfDate for balance sheet accounts
    const journalLines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          companyId: companyId!,
          date: { lte: asOfDate },
          status: 'POSTED',
        },
        account: {
          type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
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
            normalBalance: true,
          },
        },
      },
    });

    // Also calculate net income from INCOME/EXPENSE to include in equity
    const plLines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          companyId: companyId!,
          date: { lte: asOfDate },
          status: 'POSTED',
        },
        account: {
          type: { in: ['INCOME', 'EXPENSE'] },
        },
      },
      include: {
        account: { select: { type: true } },
      },
    });

    // Calculate retained earnings (net income) from P&L accounts
    let totalIncome = 0;
    let totalExpenses = 0;
    for (const line of plLines) {
      if (line.account.type === 'INCOME') {
        totalIncome += Number(line.creditAmount) - Number(line.debitAmount);
      } else {
        totalExpenses += Number(line.debitAmount) - Number(line.creditAmount);
      }
    }
    const netIncome = totalIncome - totalExpenses;

    // Aggregate balance sheet accounts
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

      // Assets: debit normal balance (debits increase, credits decrease)
      // Liabilities & Equity: credit normal balance (credits increase, debits decrease)
      if (line.account.type === 'ASSET') {
        existing.balance = existing.debits - existing.credits;
      } else {
        existing.balance = existing.credits - existing.debits;
      }

      accountTotals.set(key, existing);
    }

    // Separate into sections
    const allAccounts = Array.from(accountTotals.values());

    const currentAssets = allAccounts
      .filter((a) => a.type === 'ASSET' && (a.subType === 'CURRENT' || !a.subType))
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    const nonCurrentAssets = allAccounts
      .filter((a) => a.type === 'ASSET' && a.subType === 'NON_CURRENT')
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    const currentLiabilities = allAccounts
      .filter((a) => a.type === 'LIABILITY' && (a.subType === 'CURRENT' || !a.subType))
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    const nonCurrentLiabilities = allAccounts
      .filter((a) => a.type === 'LIABILITY' && a.subType === 'NON_CURRENT')
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    const equityAccounts = allAccounts
      .filter((a) => a.type === 'EQUITY')
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    // Calculate totals
    const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    const totalCurrentLiabilities = currentLiabilities.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

    const totalEquityAccounts = equityAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalEquity = totalEquityAccounts + netIncome;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return NextResponse.json({
      report: 'Balance Sheet',
      asOfDate: asOfDateStr,
      currency: 'JMD',
      sections: {
        assets: {
          current: {
            label: 'Current Assets',
            accounts: currentAssets,
            total: totalCurrentAssets,
          },
          nonCurrent: {
            label: 'Non-Current Assets',
            accounts: nonCurrentAssets,
            total: totalNonCurrentAssets,
          },
          totalAssets,
        },
        liabilities: {
          current: {
            label: 'Current Liabilities',
            accounts: currentLiabilities,
            total: totalCurrentLiabilities,
          },
          nonCurrent: {
            label: 'Non-Current Liabilities',
            accounts: nonCurrentLiabilities,
            total: totalNonCurrentLiabilities,
          },
          totalLiabilities,
        },
        equity: {
          label: "Owner's Equity",
          accounts: equityAccounts,
          retainedEarnings: netIncome,
          totalEquity,
        },
        totalLiabilitiesAndEquity,
      },
      balanceCheck: {
        totalAssets,
        totalLiabilitiesAndEquity,
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate balance sheet');
  }
}
