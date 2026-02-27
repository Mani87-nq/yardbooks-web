/**
 * POST/GET /api/shifts/[id]/cash
 * Cash drawer events for a shift.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

// ── GET: Cash summary for a shift ──────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: shiftId } = await context.params;
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, companyId: companyId! },
      select: {
        id: true,
        openingCash: true,
        closingCash: true,
        expectedCash: true,
        cashVariance: true,
        totalSales: true,
        totalRefunds: true,
      },
    });

    if (!shift) return notFound('Shift not found');

    const events = await prisma.cashDrawerEvent.findMany({
      where: { shiftId, companyId: companyId! },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      shift: {
        openingCash: Number(shift.openingCash),
        closingCash: shift.closingCash ? Number(shift.closingCash) : null,
        expectedCash: shift.expectedCash ? Number(shift.expectedCash) : null,
        cashVariance: shift.cashVariance ? Number(shift.cashVariance) : null,
      },
      events,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get cash summary');
  }
}

// ── POST: Record a cash event ──────────────────────────────────
const cashEventSchema = z.object({
  employeeProfileId: z.string().min(1),
  eventType: z.enum(['OPENING_COUNT', 'CLOSING_COUNT', 'CASH_DROP', 'CASH_PAYOUT', 'NO_SALE_OPEN']),
  amount: z.number(),
  denominations: z.record(z.string(), z.number()).optional(),
  expectedAmount: z.number().optional(),
  reason: z.string().max(250).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: shiftId } = await context.params;
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = cashEventSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { employeeProfileId, eventType, amount, denominations, expectedAmount, reason, notes } = parsed.data;

    // Verify shift exists
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, companyId: companyId! },
    });
    if (!shift) return notFound('Shift not found');

    // Calculate variance if expected amount provided
    const variance = expectedAmount !== undefined ? amount - expectedAmount : null;

    const event = await prisma.cashDrawerEvent.create({
      data: {
        companyId: companyId!,
        shiftId,
        employeeProfileId,
        eventType,
        amount,
        denominations: (denominations || null) as any,
        expectedAmount: expectedAmount ?? null,
        variance,
        reason: reason || null,
        notes: notes || null,
      },
    });

    // Log the cash drawer action
    if (eventType === 'NO_SALE_OPEN') {
      await prisma.pOSAction.create({
        data: {
          companyId: companyId!,
          employeeProfileId,
          actionType: 'CASH_DRAWER_OPEN',
          description: `Cash drawer opened (no sale)${reason ? `: ${reason}` : ''}`,
          shiftId,
          amount,
        },
      });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to record cash event');
  }
}
