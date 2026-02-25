/**
 * POST /api/v1/pos/business-days/[id]/close — Close a business day and generate EOD report
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const closeDaySchema = z.object({
  closingNotes: z.string().max(1000).optional(),
  forceClose: z.boolean().optional(), // Close even with active sessions (will suspend them)
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = closeDaySchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const day = await prisma.businessDay.findFirst({
      where: { id, companyId: companyId! },
      include: {
        sessions: {
          include: {
            cashMovements: true,
            _count: { select: { orders: true } },
            orders: {
              where: { status: 'COMPLETED' },
              select: {
                total: true,
                subtotal: true,
                gctAmount: true,
                orderDiscountAmount: true,
                payments: { select: { method: true, amount: true, status: true } },
              },
            },
          },
        },
      },
    });

    if (!day) return notFound('Business day not found');

    if (['CLOSED', 'FORCE_CLOSED'].includes(day.status)) {
      return badRequest('Business day is already closed.');
    }

    // Check for open sessions
    const openSessions = day.sessions.filter((s) => s.status === 'OPEN');
    if (openSessions.length > 0 && !parsed.data.forceClose) {
      return badRequest(
        `Cannot close business day with ${openSessions.length} active session(s). Close all sessions first, or use forceClose.`
      );
    }

    // Get POS settings for GCT rate
    const settings = await prisma.posSettings.findFirst({
      where: { companyId: companyId! },
      select: { gctRate: true, autoGenerateEodReport: true, allowCloseWithVariance: true, varianceThreshold: true },
    });
    const gctRate = settings?.gctRate ? Number(settings.gctRate) : 0.15;

    // Aggregate session data
    let grossSales = 0;
    let totalDiscounts = 0;
    let totalRefunds = 0;
    let totalVoids = 0;
    let totalTransactions = 0;
    let taxableAmount = 0;
    let exemptAmount = 0;
    let gctCollected = 0;
    let totalOpeningCash = 0;
    let totalCashSales = 0;
    let totalCashRefunds = 0;
    let totalPayouts = 0;
    let totalDrops = 0;
    let expectedCash = 0;
    let actualCash = 0;
    const paymentBreakdown: Record<string, { count: number; amount: number }> = {};

    for (const session of day.sessions) {
      grossSales += Number(session.totalSales);
      totalRefunds += Number(session.totalRefunds);
      totalVoids += Number(session.totalVoids);
      totalTransactions += session._count.orders;
      totalOpeningCash += Number(session.openingCash);

      if (session.status === 'CLOSED') {
        expectedCash += Number(session.expectedCash);
        actualCash += Number(session.closingCash ?? 0);
      } else {
        // For open sessions being force-closed, use expectedCash
        expectedCash += Number(session.expectedCash);
        actualCash += Number(session.expectedCash); // No count done
      }

      // Aggregate cash movements
      for (const cm of session.cashMovements) {
        const amt = Number(cm.amount);
        switch (cm.type) {
          case 'PAYOUT': totalPayouts += amt; break;
          case 'DROP': totalDrops += amt; break;
          case 'REFUND': totalCashRefunds += amt; break;
          case 'SALE': totalCashSales += amt; break;
        }
      }

      // Aggregate payment methods from completed orders
      for (const order of session.orders) {
        const orderTotal = Number(order.total);
        const orderSubtotal = Number(order.subtotal);
        const orderGct = Number(order.gctAmount);
        const orderDiscount = Number(order.orderDiscountAmount ?? 0);

        taxableAmount += orderSubtotal - orderDiscount;
        gctCollected += orderGct;
        totalDiscounts += orderDiscount;

        for (const payment of order.payments) {
          if (payment.status !== 'COMPLETED') continue;
          const method = payment.method;
          if (!paymentBreakdown[method]) {
            paymentBreakdown[method] = { count: 0, amount: 0 };
          }
          paymentBreakdown[method].count += 1;
          paymentBreakdown[method].amount += Number(payment.amount);

          // Track cash payments for reconciliation
          if (method === 'CASH') {
            totalCashSales += Number(payment.amount);
          }
        }
      }
    }

    const netSales = grossSales - totalRefunds - totalVoids - totalDiscounts;
    const cashVariance = Math.round((actualCash - expectedCash) * 100) / 100;
    const cashStatus = cashVariance === 0 ? 'balanced' : cashVariance > 0 ? 'over' : 'short';
    const hasVariance = cashVariance !== 0;
    const forceClose = parsed.data.forceClose && openSessions.length > 0;

    // Check variance threshold
    if (hasVariance && !settings?.allowCloseWithVariance) {
      const threshold = Number(settings?.varianceThreshold ?? 1000);
      if (Math.abs(cashVariance) > threshold) {
        return badRequest(
          `Cash variance ($${Math.abs(cashVariance).toFixed(2)}) exceeds threshold ($${threshold.toFixed(2)}). Approve variance before closing.`
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Force-close any open sessions
      if (forceClose) {
        for (const session of openSessions) {
          await tx.posSession.update({
            where: { id: session.id },
            data: { status: 'SUSPENDED', closedAt: new Date(), closingNotes: 'Auto-suspended: business day closed' },
          });
          await tx.posTerminal.update({
            where: { id: session.terminalId },
            data: { currentSessionId: null, isOnline: false },
          });
        }
      }

      // Close the business day
      const closedDay = await tx.businessDay.update({
        where: { id },
        data: {
          status: forceClose ? 'FORCE_CLOSED' : 'CLOSED',
          actualCloseTime: new Date(),
          closedBy: user!.sub,
          closingNotes: parsed.data.closingNotes ?? null,
          totalSales: grossSales,
          totalRefunds,
          totalVoids,
          netSales,
          totalTransactions,
          totalCashExpected: expectedCash,
          totalCashActual: actualCash,
          totalCashVariance: cashVariance,
          hasVariance,
          activeSessionCount: 0,
        },
      });

      // Generate EOD report
      let eodReport = null;
      if (settings?.autoGenerateEodReport !== false) {
        eodReport = await tx.endOfDayReport.create({
          data: {
            companyId: companyId!,
            reportNumber: `EOD-${day.date}`,
            date: day.date,
            businessDayId: id,
            openTime: day.actualOpenTime,
            closeTime: new Date(),
            grossSales,
            totalDiscounts,
            totalRefunds,
            totalVoids,
            netSales,
            totalTransactions,
            gctRate,
            taxableAmount,
            exemptAmount,
            gctCollected,
            totalOpeningCash,
            totalCashSales,
            totalCashRefunds,
            totalPayouts,
            totalDrops,
            expectedCash,
            actualCash,
            cashVariance,
            cashStatus,
            paymentBreakdown,
            sessionCount: day.sessions.length,
          },
        });
      }

      return { day: closedDay, eodReport };
    });

    return NextResponse.json(result);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to close business day');
  }
}
