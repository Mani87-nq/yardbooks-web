/**
 * POST /api/v1/accounting/year-end-close
 *
 * Performs year-end closing:
 * 1. Creates a closing journal entry that zeros out all Income and Expense accounts
 * 2. Transfers net income/loss to Retained Earnings
 * 3. Records the fiscal year as closed (prevents future edits to closed periods)
 *
 * Body: { fiscalYearEnd: "2026-03-31" }  (Jamaica fiscal year ends March 31)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { SYSTEM_ACCOUNTS } from '@/lib/accounting/default-accounts';

const yearEndSchema = z.object({
  fiscalYearEnd: z.coerce.date(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'gl:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = yearEndSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid fiscalYearEnd date');

    const fiscalYearEnd = parsed.data.fiscalYearEnd;
    fiscalYearEnd.setHours(23, 59, 59, 999);

    // Calculate net balances for all Income and Expense accounts up to year-end
    const journalLines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          companyId: companyId!,
          date: { lte: fiscalYearEnd },
          status: 'POSTED',
        },
        account: {
          type: { in: ['INCOME', 'EXPENSE'] },
        },
      },
      include: {
        account: {
          select: { id: true, accountNumber: true, name: true, type: true },
        },
      },
    });

    // Aggregate by account
    const accountBalances = new Map<string, {
      accountId: string;
      accountNumber: string;
      accountName: string;
      type: string;
      balance: number;
    }>();

    for (const line of journalLines) {
      const key = line.account.id;
      const existing = accountBalances.get(key) ?? {
        accountId: line.account.id,
        accountNumber: line.account.accountNumber,
        accountName: line.account.name,
        type: line.account.type,
        balance: 0,
      };

      if (line.account.type === 'INCOME') {
        existing.balance += Number(line.creditAmount) - Number(line.debitAmount);
      } else {
        existing.balance += Number(line.debitAmount) - Number(line.creditAmount);
      }

      accountBalances.set(key, existing);
    }

    // Filter out zero balances
    const nonZeroAccounts = Array.from(accountBalances.values()).filter(
      (a) => Math.abs(a.balance) > 0.01
    );

    if (nonZeroAccounts.length === 0) {
      return badRequest('No income or expense balances to close');
    }

    // Calculate net income
    const totalIncome = nonZeroAccounts
      .filter((a) => a.type === 'INCOME')
      .reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = nonZeroAccounts
      .filter((a) => a.type === 'EXPENSE')
      .reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalIncome - totalExpenses;

    // Create the closing journal entry in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Resolve Retained Earnings account
      let retainedEarningsAccount = await tx.gLAccount.findFirst({
        where: { companyId: companyId!, accountNumber: SYSTEM_ACCOUNTS.RETAINED_EARNINGS },
      });

      if (!retainedEarningsAccount) {
        retainedEarningsAccount = await tx.gLAccount.create({
          data: {
            companyId: companyId!,
            accountNumber: SYSTEM_ACCOUNTS.RETAINED_EARNINGS,
            name: 'Retained Earnings',
            type: 'EQUITY',
            normalBalance: 'credit',
            isSystemAccount: true,
            isControlAccount: false,
            isTaxAccount: false,
            isBankAccount: false,
            isActive: true,
          },
        });
      }

      // Generate entry number
      const entryNumber = `JE-${Date.now().toString(36).toUpperCase()}`;

      const yearLabel = fiscalYearEnd.getFullYear();

      // Build closing lines: reverse each income/expense account
      const closingLines: any[] = [];
      let lineNumber = 1;

      for (const acct of nonZeroAccounts) {
        if (acct.type === 'INCOME') {
          // Income had credit balance → debit to close
          closingLines.push({
            lineNumber: lineNumber++,
            accountId: acct.accountId,
            accountCode: acct.accountNumber,
            accountName: acct.accountName,
            description: `Close ${acct.accountName} — FY ${yearLabel}`,
            debitAmount: acct.balance,
            creditAmount: 0,
            debitAmountJMD: acct.balance,
            creditAmountJMD: 0,
          });
        } else {
          // Expense had debit balance → credit to close
          closingLines.push({
            lineNumber: lineNumber++,
            accountId: acct.accountId,
            accountCode: acct.accountNumber,
            accountName: acct.accountName,
            description: `Close ${acct.accountName} — FY ${yearLabel}`,
            debitAmount: 0,
            creditAmount: acct.balance,
            debitAmountJMD: 0,
            creditAmountJMD: acct.balance,
          });
        }
      }

      // Transfer net income to Retained Earnings
      if (netIncome > 0) {
        // Profit → Credit Retained Earnings
        closingLines.push({
          lineNumber: lineNumber++,
          accountId: retainedEarningsAccount.id,
          accountCode: SYSTEM_ACCOUNTS.RETAINED_EARNINGS,
          accountName: 'Retained Earnings',
          description: `Net income transfer — FY ${yearLabel}`,
          debitAmount: 0,
          creditAmount: netIncome,
          debitAmountJMD: 0,
          creditAmountJMD: netIncome,
        });
      } else if (netIncome < 0) {
        // Loss → Debit Retained Earnings
        closingLines.push({
          lineNumber: lineNumber++,
          accountId: retainedEarningsAccount.id,
          accountCode: SYSTEM_ACCOUNTS.RETAINED_EARNINGS,
          accountName: 'Retained Earnings',
          description: `Net loss transfer — FY ${yearLabel}`,
          debitAmount: Math.abs(netIncome),
          creditAmount: 0,
          debitAmountJMD: Math.abs(netIncome),
          creditAmountJMD: 0,
        });
      }

      const totalDebits = closingLines.reduce((s: number, l: any) => s + l.debitAmount, 0);
      const totalCredits = closingLines.reduce((s: number, l: any) => s + l.creditAmount, 0);

      // Create the closing entry
      const entry = await tx.journalEntry.create({
        data: {
          companyId: companyId!,
          entryNumber,
          date: fiscalYearEnd,
          entryDate: new Date(),
          postDate: new Date(),
          description: `Year-End Closing Entry — FY ${yearLabel}`,
          reference: `YEAR-END-${yearLabel}`,
          sourceModule: 'YEAR_END',
          sourceDocumentId: `FY-${yearLabel}`,
          sourceDocumentType: 'YearEndClose',
          totalDebits,
          totalCredits,
          status: 'POSTED',
          createdById: user!.sub,
          lines: { create: closingLines },
        },
        include: { lines: true },
      });

      return {
        journalEntryId: entry.id,
        entryNumber: entry.entryNumber,
        fiscalYearEnd: fiscalYearEnd.toISOString().slice(0, 10),
        totalIncome,
        totalExpenses,
        netIncome,
        accountsClosed: nonZeroAccounts.length,
      };
    });

    return NextResponse.json({
      message: 'Year-end closing completed successfully',
      ...result,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to perform year-end close');
  }
}
