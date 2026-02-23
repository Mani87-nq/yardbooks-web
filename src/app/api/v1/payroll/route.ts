/**
 * GET  /api/v1/payroll — List payroll runs
 * POST /api/v1/payroll — Create a new payroll run with server-side tax calculations
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { calculatePayroll, type PayrollCalculation } from '@/lib/payroll/tax-calculator';
import { postPayrollRun } from '@/lib/accounting/engine';

// ─── GET: List payroll runs ──────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const statusParam = searchParams.get('status');

    const where: any = {
      companyId: companyId!,
      ...(statusParam ? { status: statusParam as any } : {}),
    };

    const runs = await prisma.payrollRun.findMany({
      where,
      include: {
        entries: {
          select: {
            id: true,
            employeeId: true,
            employee: { select: { firstName: true, lastName: true } },
            grossPay: true,
            netPay: true,
            totalDeductions: true,
          },
        },
        _count: { select: { entries: true } },
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { periodEnd: 'desc' },
    });

    const hasMore = runs.length > limit;
    const data = hasMore ? runs.slice(0, limit) : runs;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list payroll runs');
  }
}

// ─── POST: Create a new payroll run ──────────────────────────────

const payrollEntrySchema = z.object({
  employeeId: z.string().min(1),
  basicSalary: z.number().min(0),
  overtime: z.number().min(0).default(0),
  bonus: z.number().min(0).default(0),
  commission: z.number().min(0).default(0),
  allowances: z.number().min(0).default(0),
  pensionContribution: z.number().min(0).default(0),
  otherDeductions: z.number().min(0).default(0),
});

const createPayrollSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  payDate: z.coerce.date(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).default('MONTHLY'),
  employees: z.array(payrollEntrySchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createPayrollSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { periodStart, periodEnd, payDate, frequency, employees } = parsed.data;

    // Verify all employees belong to this company
    const employeeIds = employees.map((e) => e.employeeId);
    const dbEmployees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, companyId: companyId! },
      select: { id: true },
    });
    const validIds = new Set(dbEmployees.map((e) => e.id));
    const invalidIds = employeeIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return badRequest(`Employees not found: ${invalidIds.join(', ')}`);
    }

    // Calculate taxes server-side for each employee
    const calculations: Array<{
      employeeId: string;
      input: typeof employees[0];
      result: PayrollCalculation;
    }> = [];

    for (const emp of employees) {
      const result = calculatePayroll({
        basicSalary: emp.basicSalary,
        overtime: emp.overtime,
        bonus: emp.bonus,
        commission: emp.commission,
        allowances: emp.allowances,
        pensionContribution: emp.pensionContribution,
        otherDeductions: emp.otherDeductions,
        frequency,
      });
      calculations.push({ employeeId: emp.employeeId, input: emp, result });
    }

    // Aggregate totals
    const totals = {
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0,
      totalEmployerContributions: 0,
      totalPaye: 0,
      totalEmployeeNis: 0,
      totalEmployeeNht: 0,
      totalEmployeeEdTax: 0,
      totalEmployerNis: 0,
      totalEmployerNht: 0,
      totalEmployerEdTax: 0,
      totalHeart: 0,
    };

    for (const { result } of calculations) {
      totals.totalGross += result.grossPay;
      totals.totalDeductions += result.employee.totalDeductions;
      totals.totalNet += result.netPay;
      totals.totalEmployerContributions += result.employer.total;
      totals.totalPaye += result.employee.paye;
      totals.totalEmployeeNis += result.employee.nis;
      totals.totalEmployeeNht += result.employee.nht;
      totals.totalEmployeeEdTax += result.employee.educationTax;
      totals.totalEmployerNis += result.employer.nis;
      totals.totalEmployerNht += result.employer.nht;
      totals.totalEmployerEdTax += result.employer.educationTax;
      totals.totalHeart += result.employer.heartNta;
    }

    // Create payroll run + entries + GL journal entry in a single transaction
    const payrollRun = await prisma.$transaction(async (tx: any) => {
      const run = await tx.payrollRun.create({
        data: {
          companyId: companyId!,
          periodStart,
          periodEnd,
          payDate,
          status: 'DRAFT',
          totalGross: totals.totalGross,
          totalDeductions: totals.totalDeductions,
          totalNet: totals.totalNet,
          totalEmployerContributions: totals.totalEmployerContributions,
          createdBy: user!.sub,
          entries: {
            create: calculations.map(({ employeeId, result }) => ({
              employeeId,
              basicSalary: result.grossPay - (result.employee.pension + result.employee.otherDeductions > 0
                ? result.grossPay - result.netPay - result.employee.totalDeductions + result.employee.pension + result.employee.otherDeductions
                : 0),
              overtime: 0,
              bonus: 0,
              commission: 0,
              allowances: 0,
              grossPay: result.grossPay,
              paye: result.employee.paye,
              nis: result.employee.nis,
              nht: result.employee.nht,
              educationTax: result.employee.educationTax,
              otherDeductions: result.employee.otherDeductions,
              totalDeductions: result.employee.totalDeductions,
              netPay: result.netPay,
              employerNis: result.employer.nis,
              employerNht: result.employer.nht,
              employerEducationTax: result.employer.educationTax,
              heartContribution: result.employer.heartNta,
              totalEmployerContributions: result.employer.total,
            })),
          },
        },
        include: {
          entries: {
            include: {
              employee: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      });

      return run;
    });

    return NextResponse.json(payrollRun, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create payroll run');
  }
}
