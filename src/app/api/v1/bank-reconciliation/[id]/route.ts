/**
 * GET/PUT/DELETE /api/v1/bank-reconciliation/[id]
 * Manage a specific bank reconciliation.
 * - GET: Get reconciliation details with unreconciled transactions
 * - PUT: Update reconciliation (complete, add/remove matched transactions)
 * - DELETE: Cancel a reconciliation
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'banking:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const reconciliation = await prisma.bankReconciliation.findFirst({
      where: { id, bankAccount: { companyId } },
      include: {
        bankAccount: { select: { id: true, accountName: true, bankName: true, accountNumber: true, currentBalance: true } },
        adjustments: true,
      },
    });

    if (!reconciliation) return notFound('Reconciliation not found');

    // Get all transactions in the reconciliation period
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId: reconciliation.bankAccountId,
        transactionDate: {
          gte: reconciliation.periodStart,
          lte: reconciliation.periodEnd,
        },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // Split into reconciled and unreconciled
    const reconciledIds = new Set(reconciliation.reconciledTransactionIds);
    const reconciledTransactions = transactions.filter((t) => reconciledIds.has(t.id));
    const unreconciledTransactions = transactions.filter((t) => !reconciledIds.has(t.id));

    // Calculate current reconciliation status
    const reconciledTotal = reconciledTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const unreconciledTotal = unreconciledTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const adjustmentTotal = reconciliation.adjustments.reduce((sum, a) => sum + Number(a.amount), 0);
    const clearedBalance = Number(reconciliation.openingBalance) + reconciledTotal + adjustmentTotal;
    const currentDifference = Number(reconciliation.statementBalance) - clearedBalance;

    return NextResponse.json({
      ...reconciliation,
      reconciledTransactions,
      unreconciledTransactions,
      summary: {
        reconciledCount: reconciledTransactions.length,
        unreconciledCount: unreconciledTransactions.length,
        reconciledTotal: round2(reconciledTotal),
        unreconciledTotal: round2(unreconciledTotal),
        adjustmentTotal: round2(adjustmentTotal),
        clearedBalance: round2(clearedBalance),
        currentDifference: round2(currentDifference),
        isBalanced: Math.abs(currentDifference) < 0.01,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get reconciliation');
  }
}

const updateReconciliationSchema = z.object({
  action: z.enum(['reconcile_transactions', 'unreconcile_transactions', 'complete', 'add_adjustment']),
  transactionIds: z.array(z.string()).optional(),
  adjustment: z.object({
    description: z.string().min(1),
    amount: z.number(),
    type: z.enum(['book', 'bank']).default('book'),
  }).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'banking:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const reconciliation = await prisma.bankReconciliation.findFirst({
      where: { id, bankAccount: { companyId }, status: 'IN_PROGRESS' },
      include: { adjustments: true },
    });

    if (!reconciliation) return notFound('Active reconciliation not found');

    const body = await request.json();
    const parsed = updateReconciliationSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { action, transactionIds, adjustment } = parsed.data;

    switch (action) {
      case 'reconcile_transactions': {
        if (!transactionIds?.length) return badRequest('transactionIds required');
        const currentIds = new Set(reconciliation.reconciledTransactionIds);
        for (const txnId of transactionIds) {
          currentIds.add(txnId);
        }
        const updated = await prisma.bankReconciliation.update({
          where: { id },
          data: { reconciledTransactionIds: Array.from(currentIds) },
        });
        // Mark transactions as reconciled
        await prisma.bankTransaction.updateMany({
          where: { id: { in: transactionIds } },
          data: { isReconciled: true, reconciledAt: new Date() },
        });
        return NextResponse.json(updated);
      }

      case 'unreconcile_transactions': {
        if (!transactionIds?.length) return badRequest('transactionIds required');
        const currentIds = new Set(reconciliation.reconciledTransactionIds);
        for (const txnId of transactionIds) {
          currentIds.delete(txnId);
        }
        const updated = await prisma.bankReconciliation.update({
          where: { id },
          data: { reconciledTransactionIds: Array.from(currentIds) },
        });
        await prisma.bankTransaction.updateMany({
          where: { id: { in: transactionIds } },
          data: { isReconciled: false, reconciledAt: null },
        });
        return NextResponse.json(updated);
      }

      case 'add_adjustment': {
        if (!adjustment) return badRequest('adjustment object required');
        await prisma.reconciliationAdjustment.create({
          data: {
            reconciliationId: id,
            description: adjustment.description,
            amount: adjustment.amount,
            type: adjustment.type,
          },
        });
        const updated = await prisma.bankReconciliation.findUnique({
          where: { id },
          include: { adjustments: true },
        });
        return NextResponse.json(updated);
      }

      case 'complete': {
        // Verify the reconciliation balances
        const transactions = await prisma.bankTransaction.findMany({
          where: {
            id: { in: reconciliation.reconciledTransactionIds },
          },
        });
        const reconciledTotal = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const adjustmentTotal = reconciliation.adjustments.reduce((sum, a) => sum + Number(a.amount), 0);
        const clearedBalance = Number(reconciliation.openingBalance) + reconciledTotal + adjustmentTotal;
        const difference = Number(reconciliation.statementBalance) - clearedBalance;

        if (Math.abs(difference) > 0.01) {
          return badRequest(`Reconciliation is not balanced. Difference: ${round2(difference)}`);
        }

        const completed = await prisma.bankReconciliation.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            closingBalance: reconciliation.statementBalance,
            bookBalance: clearedBalance,
            difference: 0,
            completedAt: new Date(),
            completedBy: user!.sub,
          },
        });

        return NextResponse.json(completed);
      }

      default:
        return badRequest('Invalid action');
    }
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update reconciliation');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'banking:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const reconciliation = await prisma.bankReconciliation.findFirst({
      where: { id, bankAccount: { companyId }, status: 'IN_PROGRESS' },
    });

    if (!reconciliation) return notFound('Active reconciliation not found');

    // Un-reconcile all transactions
    if (reconciliation.reconciledTransactionIds.length > 0) {
      await prisma.bankTransaction.updateMany({
        where: { id: { in: reconciliation.reconciledTransactionIds } },
        data: { isReconciled: false, reconciledAt: null },
      });
    }

    // Delete adjustments and reconciliation
    await prisma.reconciliationAdjustment.deleteMany({ where: { reconciliationId: id } });
    await prisma.bankReconciliation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to cancel reconciliation');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
