/**
 * POST /api/v1/payroll/[runId]/approve
 *
 * Approves a payroll run and posts the journal entry to the General Ledger.
 * Moves status from DRAFT → APPROVED and creates the GL entry.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { postPayrollRun } from '@/lib/accounting/engine';

type RouteContext = { params: Promise<{ runId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'payroll:approve');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Find the payroll run
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, companyId: companyId! },
      include: {
        entries: true,
      },
    });

    if (!run) return notFound('Payroll run not found');
    if (run.status !== 'DRAFT') {
      return badRequest(`Cannot approve payroll run with status: ${run.status}`);
    }

    // Aggregate tax totals from entries
    let totalPaye = 0, totalEmployeeNis = 0, totalEmployeeNht = 0, totalEmployeeEdTax = 0;
    let totalEmployerNis = 0, totalEmployerNht = 0, totalEmployerEdTax = 0, totalHeart = 0;

    for (const entry of run.entries) {
      totalPaye += Number(entry.paye);
      totalEmployeeNis += Number(entry.nis);
      totalEmployeeNht += Number(entry.nht);
      totalEmployeeEdTax += Number(entry.educationTax);
      totalEmployerNis += Number(entry.employerNis);
      totalEmployerNht += Number(entry.employerNht);
      totalEmployerEdTax += Number(entry.employerEducationTax);
      totalHeart += Number(entry.heartContribution);
    }

    // Approve + post to GL in a single transaction
    const updated = await prisma.$transaction(async (tx: any) => {
      // Post journal entry to GL
      const glResult = await postPayrollRun({
        companyId: companyId!,
        userId: user!.sub,
        payrollRunId: run.id,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        payDate: run.payDate,
        totalGross: Number(run.totalGross),
        totalPaye,
        totalEmployeeNis,
        totalEmployeeNht,
        totalEmployeeEdTax,
        totalEmployerNis,
        totalEmployerNht,
        totalEmployerEdTax,
        totalHeart,
        totalNet: Number(run.totalNet),
        tx,
      });

      if (!glResult.success) {
        throw new Error(`GL posting failed: ${glResult.error}`);
      }

      // Update payroll run status
      const updatedRun = await tx.payrollRun.update({
        where: { id: runId },
        data: {
          status: 'APPROVED',
          approvedBy: user!.sub,
          approvedAt: new Date(),
          journalEntryId: glResult.journalEntryId,
        },
        include: {
          entries: {
            include: {
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      return updatedRun;
    });

    return NextResponse.json({
      ...updated,
      message: 'Payroll approved and posted to General Ledger',
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to approve payroll');
  }
}
