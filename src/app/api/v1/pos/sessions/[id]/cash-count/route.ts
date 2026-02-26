/**
 * POST /api/v1/pos/sessions/[id]/cash-count — Record a cash drawer count
 *
 * Supports OPENING, MID_DAY, and CLOSING counts.
 * Calculates expected amount from opening cash + cash payments - cash refunds - change given.
 * Returns variance (actual - expected).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const cashCountSchema = z.object({
  countType: z.enum(['OPENING', 'MID_DAY', 'CLOSING']),
  actualAmount: z.number().min(0),
  denominations: z.record(z.string(), z.number().min(0)).optional(), // e.g., { "5000": 2, "1000": 5, "500": 3, "100": 10 }
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = cashCountSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid cash count data');
    }

    const session = await prisma.posSession.findFirst({
      where: { id, companyId: companyId! },
      include: {
        orders: {
          where: { status: 'COMPLETED' },
          include: {
            payments: { where: { status: 'COMPLETED' } },
          },
        },
        cashMovements: true,
      },
    });

    if (!session) return notFound('Session not found');

    const { countType, actualAmount, denominations, notes } = parsed.data;

    // Calculate expected cash amount
    let expectedAmount: number;

    if (countType === 'OPENING') {
      // Opening count — expected is whatever was declared as opening cash
      expectedAmount = Number(session.openingCash);
    } else {
      // Mid-day or closing — expected = opening + cash sales - cash refunds - change given + cash-in - cash-out
      const openingCash = Number(session.openingCash);

      // Sum all CASH payments received
      let cashReceived = 0;
      let changeGiven = 0;
      for (const order of session.orders) {
        for (const payment of order.payments) {
          if (payment.method === 'CASH') {
            cashReceived += Number(payment.amount);
            if (payment.changeGiven) {
              changeGiven += Number(payment.changeGiven);
            }
          }
        }
      }

      // Sum cash movements (CASH_IN, CASH_OUT, FLOAT_ADD, etc.)
      let cashIn = 0;
      let cashOut = 0;
      for (const movement of session.cashMovements) {
        if (['CASH_IN', 'FLOAT_ADD'].includes(movement.type)) {
          cashIn += Number(movement.amount);
        } else if (['CASH_OUT', 'DROP'].includes(movement.type)) {
          cashOut += Number(movement.amount);
        }
      }

      expectedAmount = openingCash + cashReceived - changeGiven + cashIn - cashOut;
    }

    expectedAmount = Math.round(expectedAmount * 100) / 100;
    const variance = Math.round((actualAmount - expectedAmount) * 100) / 100;

    // Create the cash drawer count record
    const count = await prisma.cashDrawerCount.create({
      data: {
        sessionId: id,
        countType,
        expectedAmount,
        actualAmount,
        variance,
        denominations: denominations ?? undefined,
        notes,
        countedBy: user!.sub,
      },
    });

    return NextResponse.json({
      count,
      summary: {
        countType,
        expectedAmount,
        actualAmount,
        variance,
        status: variance === 0 ? 'BALANCED' : variance > 0 ? 'OVER' : 'SHORT',
      },
    }, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to record cash count');
  }
}

// ─── GET: List cash counts for a session ─────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const session = await prisma.posSession.findFirst({
      where: { id, companyId: companyId! },
      select: { id: true },
    });
    if (!session) return notFound('Session not found');

    const counts = await prisma.cashDrawerCount.findMany({
      where: { sessionId: id },
      orderBy: { countedAt: 'asc' },
    });

    return NextResponse.json({ data: counts });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list cash counts');
  }
}
