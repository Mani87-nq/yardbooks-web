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
import { sendEmail } from '@/lib/email/service';
import { payslipEmail } from '@/lib/email/templates';

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

    // 1. Validate payroll run exists and belongs to this company
    const payrollRun = await prisma.payrollRun.findFirst({
      where: { id: runId, companyId: companyId! },
      include: {
        entries: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        company: {
          select: { businessName: true, tradingName: true, currency: true, email: true, logoUrl: true },
        },
      },
    });
    if (!payrollRun) return notFound('Payroll run not found');

    // 2. Require run status APPROVED or PAID
    if (payrollRun.status !== 'APPROVED' && payrollRun.status !== 'PAID') {
      return badRequest(
        `Payslips can only be emailed for APPROVED or PAID runs. Current status: ${payrollRun.status}`,
      );
    }

    // 3. Email payslips to each employee
    const companyName =
      payrollRun.company.tradingName || payrollRun.company.businessName;
    const currency = payrollRun.company.currency || 'JMD';

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entry of payrollRun.entries) {
      const { employee } = entry;

      // Skip if no email address
      if (!employee.email) {
        continue;
      }

      try {
        // Build payslip data and generate HTML
        const payslipData = await buildPayslipData(runId, employee.id, companyId!);
        if (!payslipData) {
          failed++;
          errors.push(`${employee.firstName} ${employee.lastName}: failed to build payslip data`);
          continue;
        }

        const payslipHtml = generatePayslipHtml(payslipData);

        // Build email using the payslip template with tenant branding
        const email = payslipEmail({
          employeeName: `${employee.firstName} ${employee.lastName}`,
          payPeriod: payslipData.payPeriod,
          netPay: payslipData.netPay,
          currency,
          companyName,
          companyLogoUrl: payrollRun.company.logoUrl || undefined,
        });

        // Send email with the payslip HTML as an attachment
        const result = await sendEmail({
          to: employee.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          replyTo: payrollRun.company.email || undefined,
          attachments: [
            {
              filename: `Payslip-${employee.firstName}-${employee.lastName}.html`,
              content: payslipHtml,
              contentType: 'text/html',
            },
          ],
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
          errors.push(`${employee.firstName} ${employee.lastName}: ${result.error}`);
        }
      } catch (err) {
        failed++;
        errors.push(
          `${employee.firstName} ${employee.lastName}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      }
    }

    return NextResponse.json({
      message: `Payslip emails sent: ${sent} succeeded, ${failed} failed`,
      payrollRunId: runId,
      sent,
      failed,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to email payslips',
    );
  }
}
