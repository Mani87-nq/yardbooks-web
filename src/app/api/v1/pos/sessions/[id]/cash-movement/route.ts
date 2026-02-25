/**
 * POST /api/v1/pos/sessions/[id]/cash-movement — Record a cash movement (drop, payout, float add)
 * GET  /api/v1/pos/sessions/[id]/cash-movement — List cash movements for a session
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
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

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
    const { user, error: authError } = await requirePermission(request, 'pos:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

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

    // Determine how this movement affects expected cash
    // DROP removes cash from drawer, PAYOUT removes cash, ADJUSTMENT adds cash
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
          performedBy: user!.sub,
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
