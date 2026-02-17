/**
 * GET/POST /api/v1/payroll/[runId]/payslips
 *
 * GET  - Generate payslip HTML for all employees in a payroll run, or for a
 *        specific employee when ?employeeId=xxx is provided.
 * POST - Email payslips to employees (stub - TODO).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { buildPayslipData, generatePayslipHtml } from '@/lib/payslip-generator';

type RouteContext = { params: Promise<{ runId: string }> };

// ---------------------------------------------------------------------------
// GET - Generate payslip(s)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { runId } = await context.params;

    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Validate the payroll run exists and belongs to this company
    const payrollRun = await prisma.payrollRun.findFirst({
      where: { id: runId, companyId: companyId! },
      include: {
        entries: {
          select: {
            employeeId: true,
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!payrollRun) return notFound('Payroll run not found');

    // Optionally filter to a single employee
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    let entries = payrollRun.entries;
    if (employeeId) {
      entries = entries.filter((e) => e.employeeId === employeeId);
      if (entries.length === 0) {
        return notFound('Employee not found in this payroll run');
      }
    }

    // Build payslip data and generate HTML for each entry
    const payslips: Array<{
      employeeId: string;
      employeeName: string;
      html: string;
    }> = [];

    for (const entry of entries) {
      const data = await buildPayslipData(runId, entry.employeeId, companyId!);
      if (!data) continue;

      payslips.push({
        employeeId: entry.employeeId,
        employeeName: `${entry.employee.firstName} ${entry.employee.lastName}`,
        html: generatePayslipHtml(data),
      });
    }

    return NextResponse.json({ data: payslips });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to generate payslips',
    );
  }
}

// ---------------------------------------------------------------------------
// POST - Email payslips to employees (stub)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { runId } = await context.params;

    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Validate payroll run
    const payrollRun = await prisma.payrollRun.findFirst({
      where: { id: runId, companyId: companyId! },
    });
    if (!payrollRun) return notFound('Payroll run not found');

    // TODO: Implement email delivery of payslips to employees.
    // This should:
    //   1. Build payslip data for each employee in the run
    //   2. Generate HTML for each payslip
    //   3. Convert to PDF (using a library like puppeteer or @react-pdf/renderer)
    //   4. Send email with PDF attachment via the email service
    //   5. Log the delivery status for each employee

    return NextResponse.json({
      message: 'Payslip email delivery is not yet implemented',
      payrollRunId: runId,
    });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to email payslips',
    );
  }
}
