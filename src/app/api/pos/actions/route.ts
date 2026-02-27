/**
 * GET/POST /api/pos/actions
 * POS action audit log.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ── GET: List POS actions with filters ─────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const url = new URL(request.url);
    const employeeProfileId = url.searchParams.get('employeeProfileId');
    const actionType = url.searchParams.get('type');
    const dateFrom = url.searchParams.get('from');
    const dateTo = url.searchParams.get('to');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 500);
    const offset = Number(url.searchParams.get('offset')) || 0;

    const where: Record<string, unknown> = {
      companyId: companyId!,
    };

    if (employeeProfileId) {
      where.employeeProfileId = employeeProfileId;
    }

    if (actionType) {
      where.actionType = actionType;
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [actions, total] = await Promise.all([
      prisma.pOSAction.findMany({
        where,
        include: {
          employeeProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.pOSAction.count({ where }),
    ]);

    return NextResponse.json({ data: actions, total, limit, offset });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list POS actions');
  }
}

// ── POST: Log a POS action ──────────────────────────────────────
const posActionSchema = z.object({
  employeeProfileId: z.string().min(1),
  actionType: z.enum([
    'SALE', 'VOID', 'REFUND', 'DISCOUNT', 'PRICE_OVERRIDE',
    'CASH_DRAWER_OPEN', 'NO_SALE', 'CLOCK_IN', 'CLOCK_OUT',
    'BREAK_START', 'BREAK_END', 'MANAGER_OVERRIDE', 'FAILED_PIN',
  ]),
  description: z.string().max(500).optional(),
  orderId: z.string().optional(),
  shiftId: z.string().optional(),
  terminalId: z.string().optional(),
  amount: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = posActionSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const data = parsed.data;

    const action = await prisma.pOSAction.create({
      data: {
        companyId: companyId!,
        employeeProfileId: data.employeeProfileId,
        actionType: data.actionType,
        description: data.description || null,
        orderId: data.orderId || null,
        shiftId: data.shiftId || null,
        terminalId: data.terminalId || null,
        amount: data.amount ?? null,
        metadata: (data.metadata || null) as any,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to log POS action');
  }
}
