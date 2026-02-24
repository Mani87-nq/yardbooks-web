/**
 * POST /api/v1/payroll/[runId]/mark-paid
 *
 * Marks an APPROVED payroll run as PAID and records the payment date.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ runId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'payroll:approve');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, companyId: companyId! },
    });

    if (!run) return notFound('Payroll run not found');
    if (run.status !== 'APPROVED') {
      return badRequest(`Cannot mark as paid: current status is ${run.status}. Must be APPROVED.`);
    }

    const updated = await prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'PAID',
      },
      include: {
        entries: {
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json({
      ...updated,
      message: 'Payroll run marked as paid',
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to mark payroll as paid');
  }
}
