/**
 * POST /api/v1/journal-entries/[id]/void
 *
 * Voids a journal entry. If previously posted, reverses GL account balances.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'journal:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.journalEntry.findFirst({
      where: { id, companyId: companyId! },
      include: { lines: { include: { account: true } } },
    });
    if (!existing) return notFound('Journal entry not found');
    if (existing.status === 'VOID') {
      return badRequest('Entry is already voided');
    }

    // If posted, reverse GL account balances
    if (existing.status === 'POSTED') {
      for (const line of existing.lines) {
        const account = line.account;
        if (!account) continue;

        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type);
        // Reverse: opposite of posting
        const balanceChange = isDebitNormal
          ? Number(line.creditAmount) - Number(line.debitAmount)
          : Number(line.debitAmount) - Number(line.creditAmount);

        await prisma.gLAccount.update({
          where: { id: account.id },
          data: { currentBalance: { increment: balanceChange } },
        });
      }
    }

    const entry = await prisma.journalEntry.update({
      where: { id },
      data: { status: 'VOID' },
      include: { lines: { include: { account: { select: { accountNumber: true, name: true } } } } },
    });

    return NextResponse.json(entry);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to void journal entry');
  }
}
