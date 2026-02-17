/**
 * POST /api/v1/bank-reconciliation/[id]/match
 * Auto-suggest matches between bank transactions and book transactions.
 * Uses amount matching and date proximity to find potential matches.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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

    // Get unreconciled bank transactions in the period
    const reconciledIds = new Set(reconciliation.reconciledTransactionIds);
    const bankTransactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId: reconciliation.bankAccountId,
        transactionDate: {
          gte: reconciliation.periodStart,
          lte: reconciliation.periodEnd,
        },
        isReconciled: false,
      },
      orderBy: { transactionDate: 'asc' },
    });

    const unreconciledTxns = bankTransactions.filter((t) => !reconciledIds.has(t.id));

    // Get book-side documents for matching: invoices (payments), expenses
    // Look at invoices paid in the period
    const payments = await prisma.payment.findMany({
      where: {
        invoice: { companyId },
        date: {
          gte: reconciliation.periodStart,
          lte: reconciliation.periodEnd,
        },
      },
      include: {
        invoice: { select: { invoiceNumber: true, customerId: true } },
      },
    });

    const expenses = await prisma.expense.findMany({
      where: {
        companyId,
        deletedAt: null,
        date: {
          gte: reconciliation.periodStart,
          lte: reconciliation.periodEnd,
        },
      },
    });

    // Build match suggestions
    const suggestions: MatchSuggestion[] = [];

    for (const txn of unreconciledTxns) {
      const txnAmount = Number(txn.amount);
      const txnDate = txn.transactionDate.getTime();

      // Already has a match assigned
      if (txn.matchedDocumentId) continue;

      const candidates: MatchCandidate[] = [];

      // Try matching against payments (positive amounts = deposits from customers)
      if (txnAmount > 0) {
        for (const payment of payments) {
          const paymentAmount = Number(payment.amount);
          const amountDiff = Math.abs(txnAmount - paymentAmount);
          const dateDiff = Math.abs(txnDate - payment.date.getTime()) / (1000 * 60 * 60 * 24);

          if (amountDiff < 0.01 && dateDiff <= 5) {
            candidates.push({
              documentType: 'payment',
              documentId: payment.id,
              reference: `Payment for ${payment.invoice.invoiceNumber}`,
              amount: paymentAmount,
              date: payment.date.toISOString(),
              confidence: calculateConfidence(amountDiff, dateDiff),
            });
          }
        }
      }

      // Try matching against expenses (negative amounts = outflows to vendors)
      if (txnAmount < 0) {
        for (const expense of expenses) {
          const expenseAmount = Number(expense.amount) + Number(expense.gctAmount);
          const amountDiff = Math.abs(Math.abs(txnAmount) - expenseAmount);
          const dateDiff = Math.abs(txnDate - expense.date.getTime()) / (1000 * 60 * 60 * 24);

          if (amountDiff < 0.01 && dateDiff <= 5) {
            candidates.push({
              documentType: 'expense',
              documentId: expense.id,
              reference: expense.reference || expense.description,
              amount: -expenseAmount,
              date: expense.date.toISOString(),
              confidence: calculateConfidence(amountDiff, dateDiff),
            });
          }
        }
      }

      if (candidates.length > 0) {
        // Sort by confidence descending
        candidates.sort((a, b) => b.confidence - a.confidence);
        suggestions.push({
          transactionId: txn.id,
          transactionDate: txn.transactionDate.toISOString(),
          transactionDescription: txn.description,
          transactionAmount: txnAmount,
          matches: candidates.slice(0, 3), // Top 3 matches
        });
      }
    }

    return NextResponse.json({
      reconciliationId: id,
      totalUnreconciled: unreconciledTxns.length,
      suggestionsFound: suggestions.length,
      suggestions,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate match suggestions');
  }
}

function calculateConfidence(amountDiff: number, dateDiff: number): number {
  // Perfect amount match gives base 80%, then date proximity adds up to 20%
  let confidence = amountDiff < 0.01 ? 80 : Math.max(0, 60 - amountDiff * 10);
  confidence += Math.max(0, 20 - dateDiff * 4); // Lose 4% per day difference
  return Math.min(100, Math.round(confidence));
}

interface MatchCandidate {
  documentType: string;
  documentId: string;
  reference: string;
  amount: number;
  date: string;
  confidence: number;
}

interface MatchSuggestion {
  transactionId: string;
  transactionDate: string;
  transactionDescription: string;
  transactionAmount: number;
  matches: MatchCandidate[];
}
