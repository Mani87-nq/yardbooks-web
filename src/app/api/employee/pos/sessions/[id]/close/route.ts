/**
 * POST /api/employee/pos/sessions/[id]/close — Close session, calculate cash variance
 *
 * Terminal-auth wrapper around admin session close logic.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const closeSessionSchema = z.object({
  closingCash: z.number().min(0),
  closingNotes: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const parsed = closeSessionSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const session = await prisma.posSession.findFirst({
      where: { id, companyId: companyId! },
      include: {
        orders: {
          select: { total: true, status: true, changeGiven: true },
        },
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
        `Cannot close session with ${pendingOrders.length} pending order(s). Complete or void them first.`
      );
    }

    const closingCash = Number(parsed.data.closingCash);
    const cashVariance = Math.round((closingCash - Number(session.expectedCash)) * 100) / 100;

    const closedSession = await prisma.$transaction(async (tx) => {
      // Record closing count cash movement
      await tx.cashMovement.create({
        data: {
          sessionId: id,
          type: 'CLOSING_COUNT',
          amount: parsed.data.closingCash,
          performedBy: employee!.sub,
          reason: 'Closing cash count',
        },
      });

      // Update session
      const updated = await tx.posSession.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closingCash: parsed.data.closingCash,
          cashVariance,
          closingNotes: parsed.data.closingNotes ?? null,
        },
        include: {
          terminal: { select: { id: true, name: true, location: true } },
          cashMovements: { orderBy: { performedAt: 'desc' } },
        },
      });

      // Clear terminal's current session
      await tx.posTerminal.update({
        where: { id: session.terminalId },
        data: { currentSessionId: null, isOnline: false },
      });

      return updated;
    });

    return NextResponse.json(closedSession);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to close session');
  }
}
