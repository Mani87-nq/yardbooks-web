/**
 * GET /api/v1/reports/general-ledger
 * General Ledger detail report — every transaction per GL account with running balance.
 * Supports date range filtering and CSV export.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { requireFeature } from '@/lib/plan-gate.server';

export async function GET(request: NextRequest) {
  try {
    // Plan gate: general ledger report requires BUSINESS plan (advanced_reports)
    const { error: planError } = await requireFeature(request, 'advanced_reports');
    if (planError) return planError;

    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format'); // 'json' or 'csv'

    if (!startDate || !endDate) {
      return badRequest('startDate and endDate query parameters are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return badRequest('Invalid date format');
    }

    // Build the where clause for accounts
    const accountWhere: Record<string, unknown> = {
      companyId,
      isActive: true,
      isHeader: false,
    };
    if (accountId) {
      accountWhere.id = accountId;
    }

    // Get matching accounts
    const accounts = await prisma.gLAccount.findMany({
      where: accountWhere,
      select: {
        id: true,
        accountNumber: true,
        name: true,
        type: true,
        normalBalance: true,
      },
      orderBy: { accountNumber: 'asc' },
    });

    const accountIds = accounts.map((a) => a.id);

    // Calculate opening balance (all posted entries before startDate)
    const openingAggregates = await prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debitAmount: true, creditAmount: true },
      where: {
        accountId: { in: accountIds },
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: { lt: start },
        },
      },
    });

    const openingMap = new Map<string, number>();
    for (const agg of openingAggregates) {
      openingMap.set(agg.accountId, Number(agg._sum.debitAmount ?? 0) - Number(agg._sum.creditAmount ?? 0));
    }

    // Get all journal lines in the date range
    const journalLines = await prisma.journalLine.findMany({
      where: {
        accountId: { in: accountIds },
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: { gte: start, lte: end },
        },
      },
      include: {
        journalEntry: {
          select: {
            entryNumber: true,
            date: true,
            description: true,
            reference: true,
            sourceModule: true,
          },
        },
      },
      orderBy: [
        { journalEntry: { date: 'asc' } },
        { lineNumber: 'asc' },
      ],
    });

    // Group lines by account and compute running balance
    const accountData = accounts.map((account) => {
      const openingBalance = openingMap.get(account.id) ?? 0;
      const lines = journalLines.filter((l) => l.accountId === account.id);

      let runningBalance = openingBalance;
      const transactions = lines.map((line) => {
        const debit = Number(line.debitAmount);
        const credit = Number(line.creditAmount);
        runningBalance += debit - credit;

        return {
          date: line.journalEntry.date.toISOString(),
          entryNumber: line.journalEntry.entryNumber,
          description: line.description || line.journalEntry.description,
          reference: line.journalEntry.reference,
          sourceModule: line.journalEntry.sourceModule,
          debit: round2(debit),
          credit: round2(credit),
          balance: round2(runningBalance),
        };
      });

      const periodDebits = lines.reduce((sum, l) => sum + Number(l.debitAmount), 0);
      const periodCredits = lines.reduce((sum, l) => sum + Number(l.creditAmount), 0);

      return {
        accountId: account.id,
        accountNumber: account.accountNumber,
        accountName: account.name,
        accountType: account.type,
        normalBalance: account.normalBalance,
        openingBalance: round2(openingBalance),
        periodDebits: round2(periodDebits),
        periodCredits: round2(periodCredits),
        closingBalance: round2(runningBalance),
        transactionCount: transactions.length,
        transactions,
      };
    }).filter((a) => a.transactionCount > 0 || Math.abs(a.openingBalance) > 0.001);

    // CSV export
    if (format === 'csv') {
      const csvLines: string[] = ['Account Number,Account Name,Date,Entry Number,Description,Reference,Debit,Credit,Balance'];
      for (const account of accountData) {
        csvLines.push(`${account.accountNumber},${csvEscape(account.accountName)},,,Opening Balance,,,${account.openingBalance}`);
        for (const txn of account.transactions) {
          csvLines.push(
            `${account.accountNumber},${csvEscape(account.accountName)},${txn.date.split('T')[0]},${txn.entryNumber},${csvEscape(txn.description ?? '')},${csvEscape(txn.reference ?? '')},${txn.debit || ''},${txn.credit || ''},${txn.balance}`
          );
        }
        csvLines.push(`${account.accountNumber},${csvEscape(account.accountName)},,,Closing Balance,,,${account.closingBalance}`);
        csvLines.push(''); // blank line between accounts
      }

      return new NextResponse(csvLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="general-ledger-${startDate}-${endDate}.csv"`,
        },
      });
    }

    return NextResponse.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      accountCount: accountData.length,
      accounts: accountData,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate general ledger report');
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
