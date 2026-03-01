/**
 * GET  /api/employee/pos/sessions/[id]/cash-movement — List cash movements
 * POST /api/employee/pos/sessions/[id]/cash-movement — Record cash drop, payout, or adjustment
 *
 * Terminal-auth wrapper around admin cash movement logic.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    // Verify session belongs to company
    const session = await prisma.posSession.findFirst({
      where: { id, companyId: companyId! },
      select: { id: true },
    });
    if (!session) return notFound('Session not found');

    const movements = await prisma.cashMovement.findMany({
      where: { sessionId: id },
      orderBy: { performedAt: 'desc' },
    });

    return NextResponse.json({ data: movements });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list cash movements');
  }
}

const cashMovementSchema = z.object({
  type: z.enum(['PAYOUT', 'DROP', 'ADJUSTMENT']),
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().min(1).max(500),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const parsed = cashMovementSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Verify session is open
    const session = await prisma.posSession.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!session) return notFound('Session not found');
    if (session.status !== 'OPEN') {
      return badRequest('Cannot add cash movement to a closed session.');
    }

    // DROP/PAYOUT removes cash from drawer, ADJUSTMENT adds cash
    const cashEffect = parsed.data.type === 'ADJUSTMENT'
      ? parsed.data.amount
      : -parsed.data.amount;

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          sessionId: id,
          type: parsed.data.type,
          amount: parsed.data.amount,
          reason: parsed.data.reason,
          performedBy: employee!.sub,
        },
      });

      // Update session expected cash
      await tx.posSession.update({
        where: { id },
        data: {
          expectedCash: { increment: cashEffect },
        },
      });

      return movement;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to record cash movement');
  }
}
