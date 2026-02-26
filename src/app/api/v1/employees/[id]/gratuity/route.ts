/**
 * GET  /api/v1/employees/[id]/gratuity — Calculate gratuity estimate
 * POST /api/v1/employees/[id]/gratuity — Process gratuity payment (creates payroll entry)
 *
 * Jamaica Employment (Termination and Redundancy Payments) Act:
 * 2 weeks' basic pay per year of service, capped at 5 years.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { calculateGratuity, type GratuityInput } from '@/lib/payroll/gratuity-calculator';

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET: Calculate gratuity estimate ──────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { id } = await context.params;

    const employee = await prisma.employee.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        baseSalary: true,
        paymentFrequency: true,
        hireDate: true,
        terminationDate: true,
        isActive: true,
      },
    });

    if (!employee) {
      return notFound('Employee not found');
    }

    const { searchParams } = new URL(request.url);
    const reason = (searchParams.get('reason') || 'ESTIMATE') as GratuityInput['reason'];
    const asOfDateStr = searchParams.get('asOfDate');
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : (employee.terminationDate ?? new Date());

    const result = calculateGratuity({
      baseSalary: Number(employee.baseSalary),
      paymentFrequency: employee.paymentFrequency as GratuityInput['paymentFrequency'],
      hireDate: employee.hireDate,
      terminationDate: asOfDate,
      reason,
    });

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        baseSalary: Number(employee.baseSalary),
        paymentFrequency: employee.paymentFrequency,
        hireDate: employee.hireDate,
        isActive: employee.isActive,
      },
      gratuity: result,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to calculate gratuity');
  }
}

// ─── POST: Process gratuity payment ──────────────────────────────

const processGratuitySchema = z.object({
  reason: z.enum(['REDUNDANCY', 'RESIGNATION', 'RETIREMENT', 'TERMINATION']),
  terminationDate: z.coerce.date(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { id } = await context.params;

    const body = await request.json();
    const parsed = processGratuitySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid gratuity request');
    }

    const employee = await prisma.employee.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        baseSalary: true,
        paymentFrequency: true,
        hireDate: true,
      },
    });

    if (!employee) {
      return notFound('Employee not found');
    }

    // Calculate gratuity
    const result = calculateGratuity({
      baseSalary: Number(employee.baseSalary),
      paymentFrequency: employee.paymentFrequency as GratuityInput['paymentFrequency'],
      hireDate: employee.hireDate,
      terminationDate: parsed.data.terminationDate,
      reason: parsed.data.reason,
    });

    if (!result.eligible) {
      return badRequest(result.ineligibleReason || 'Employee not eligible for gratuity');
    }

    // Create a special payroll run for the gratuity payment
    const payrollRun = await prisma.$transaction(async (tx: any) => {
      const run = await tx.payrollRun.create({
        data: {
          companyId: companyId!,
          periodStart: parsed.data.terminationDate,
          periodEnd: parsed.data.terminationDate,
          payDate: parsed.data.terminationDate,
          status: 'DRAFT',
          totalGross: result.amount,
          totalDeductions: 0,
          totalNet: result.amount,
          totalEmployerContributions: 0,
          createdBy: user!.sub,
          entries: {
            create: [{
              employeeId: employee.id,
              basicSalary: 0,
              overtime: 0,
              bonus: result.amount,  // Gratuity recorded as bonus/special payment
              commission: 0,
              allowances: 0,
              grossPay: result.amount,
              paye: 0,    // Gratuity is typically tax-exempt in Jamaica
              nis: 0,
              nht: 0,
              educationTax: 0,
              otherDeductions: 0,
              totalDeductions: 0,
              netPay: result.amount,
              employerNis: 0,
              employerNht: 0,
              employerEducationTax: 0,
              heartContribution: 0,
              totalEmployerContributions: 0,
            }],
          },
        },
        include: {
          entries: {
            include: {
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      // Update employee termination date if processing actual termination
      if (parsed.data.reason !== 'RETIREMENT') {
        await tx.employee.update({
          where: { id: employee.id },
          data: {
            terminationDate: parsed.data.terminationDate,
            isActive: false,
          },
        });
      }

      return run;
    });

    return NextResponse.json({
      payrollRun,
      gratuity: result,
      notes: parsed.data.notes,
    }, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to process gratuity');
  }
}
