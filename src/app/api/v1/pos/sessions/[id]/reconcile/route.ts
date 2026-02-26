/**
 * POST /api/v1/pos/sessions/[id]/reconcile — Close session with full reconciliation
 *
 * Performs final cash count, records closing count, updates session totals,
 * and closes the session. Returns a detailed reconciliation summary.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const reconcileSchema = z.object({
  closingCash: z.number().min(0),
  denominations: z.record(z.string(), z.number().min(0)).optional(),
  closingNotes: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = reconcileSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid reconciliation data');
    }

    const session = await prisma.posSession.findFirst({
      where: { id, companyId: companyId! },
      include: {
        orders: {
          include: {
            payments: { where: { status: 'COMPLETED' } },
          },
        },
        cashMovements: true,
        returns: true,
      },
    });

    if (!session) return notFound('Session not found');
    if (session.status === 'CLOSED') {
      return badRequest('Session is already closed');
    }

    // Check for pending orders
    const pendingOrders = session.orders.filter((o) =>
      ['DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID'].includes(o.status)
    );
    if (pendingOrders.length > 0) {
      return badRequest(
        `Cannot reconcile with ${pendingOrders.length} pending order(s). Complete or void them first.`
      );
    }

    // ── Calculate detailed reconciliation ──
    const openingCash = Number(session.openingCash);
    const completedOrders = session.orders.filter((o) => o.status === 'COMPLETED');
    const voidedOrders = session.orders.filter((o) => o.status === 'VOIDED');

    // Payment method breakdown
    const paymentsByMethod: Record<string, { count: number; total: number }> = {};
    let totalCashReceived = 0;
    let totalChangeGiven = 0;

    for (const order of completedOrders) {
      for (const payment of order.payments) {
        const method = payment.method;
        if (!paymentsByMethod[method]) {
          paymentsByMethod[method] = { count: 0, total: 0 };
        }
        paymentsByMethod[method].count += 1;
        paymentsByMethod[method].total += Number(payment.amount);

        if (method === 'CASH') {
          totalCashReceived += Number(payment.amount);
          totalChangeGiven += Number(payment.changeGiven ?? 0);
        }
      }
    }

    // Cash movements (cash-in, cash-out, drops, float adds)
    let cashIn = 0;
    let cashOut = 0;
    for (const movement of session.cashMovements) {
      if (['CASH_IN', 'FLOAT_ADD'].includes(movement.type)) {
        cashIn += Number(movement.amount);
      } else if (['CASH_OUT', 'DROP'].includes(movement.type)) {
        cashOut += Number(movement.amount);
      }
    }

    // Expected cash = opening + cash received - change given + cash-in - cash-out
    const expectedCash = Math.round(
      (openingCash + totalCashReceived - totalChangeGiven + cashIn - cashOut) * 100
    ) / 100;

    const { closingCash, denominations, closingNotes } = parsed.data;
    const cashVariance = Math.round((closingCash - expectedCash) * 100) / 100;

    // Totals
    const totalSales = completedOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalRefunds = session.returns.reduce((sum, r) => sum + Number(r.totalRefund ?? 0), 0);
    const totalVoids = voidedOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const netSales = Math.round((totalSales - totalRefunds) * 100) / 100;

    // Perform the reconciliation in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Record the closing cash count
      const cashCount = await tx.cashDrawerCount.create({
        data: {
          sessionId: id,
          countType: 'CLOSING',
          expectedAmount: expectedCash,
          actualAmount: closingCash,
          variance: cashVariance,
          denominations: denominations ?? undefined,
          notes: closingNotes,
          countedBy: user!.sub,
        },
      });

      // Record closing cash movement
      await tx.cashMovement.create({
        data: {
          sessionId: id,
          type: 'CLOSING_COUNT',
          amount: closingCash,
          performedBy: user!.sub,
          reason: `Closing reconciliation. Variance: J$${cashVariance.toFixed(2)}`,
        },
      });

      // Update and close the session
      const closedSession = await tx.posSession.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closingCash,
          expectedCash: expectedCash,
          cashVariance,
          totalSales: Math.round(totalSales * 100) / 100,
          totalRefunds: Math.round(totalRefunds * 100) / 100,
          totalVoids: Math.round(totalVoids * 100) / 100,
          netSales,
          closingNotes,
        },
      });

      // Clear terminal's current session
      await tx.posTerminal.update({
        where: { id: session.terminalId },
        data: { currentSessionId: null, isOnline: false },
      });

      return { closedSession, cashCount };
    });

    // Build detailed reconciliation report
    return NextResponse.json({
      session: result.closedSession,
      reconciliation: {
        openingCash,
        cashSales: Math.round(totalCashReceived * 100) / 100,
        changeGiven: Math.round(totalChangeGiven * 100) / 100,
        cashIn: Math.round(cashIn * 100) / 100,
        cashOut: Math.round(cashOut * 100) / 100,
        expectedCash,
        actualCash: closingCash,
        variance: cashVariance,
        varianceStatus: cashVariance === 0 ? 'BALANCED' : cashVariance > 0 ? 'OVER' : 'SHORT',
      },
      salesSummary: {
        totalOrders: completedOrders.length,
        totalSales: Math.round(totalSales * 100) / 100,
        totalRefunds: Math.round(totalRefunds * 100) / 100,
        totalVoids: Math.round(totalVoids * 100) / 100,
        netSales,
        paymentMethods: paymentsByMethod,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to reconcile session');
  }
}
