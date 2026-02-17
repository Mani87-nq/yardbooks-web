/**
 * GET/POST /api/v1/employees/[id]/leave
 *
 * GET  - Retrieve leave balances for the employee (payroll:read)
 * POST - Record leave usage or initialize balances  (payroll:create)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import {
  getAllLeaveBalances,
  recordLeaveUsage,
  initializeLeaveBalances,
  LEAVE_TYPES,
} from '@/lib/payroll/leave-tracker';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET - list leave balances
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify employee belongs to the company
    const employee = await prisma.employee.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      select: { id: true },
    });
    if (!employee) return notFound('Employee not found');

    const balances = await getAllLeaveBalances(id);

    return NextResponse.json({ employeeId: id, balances });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to get leave balances',
    );
  }
}

// ---------------------------------------------------------------------------
// POST - record leave usage or initialize
// ---------------------------------------------------------------------------

const recordLeaveSchema = z.object({
  action: z.enum(['record', 'initialize']),
  leaveType: z
    .enum(LEAVE_TYPES as unknown as [string, ...string[]])
    .optional(),
  days: z.number().positive().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'payroll:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify employee belongs to the company
    const employee = await prisma.employee.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      select: { id: true },
    });
    if (!employee) return notFound('Employee not found');

    const body = await request.json();
    const parsed = recordLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Validation failed: action is required (record | initialize)');
    }

    const { action, leaveType, days } = parsed.data;

    if (action === 'initialize') {
      const balances = await initializeLeaveBalances(id, companyId!);
      return NextResponse.json({ employeeId: id, balances }, { status: 201 });
    }

    // action === 'record'
    if (!leaveType || !days) {
      return badRequest('leaveType and days are required when action is "record"');
    }

    const updated = await recordLeaveUsage(id, leaveType, days);
    return NextResponse.json({ employeeId: id, balance: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process leave request';
    if (
      message.includes('Insufficient leave balance') ||
      message.includes('No leave balance found')
    ) {
      return badRequest(message);
    }
    return internalError(message);
  }
}
