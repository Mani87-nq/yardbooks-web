/**
 * GET /api/v1/exports/p45
 * Generate P45 Leaving Certificate for a terminated employee.
 * Certificate of pay and tax on employee termination.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const terminationDate = searchParams.get('terminationDate');

    if (!employeeId || !terminationDate) {
      return badRequest('employeeId and terminationDate are required');
    }

    const termDate = new Date(terminationDate);
    if (isNaN(termDate.getTime())) {
      return badRequest('Invalid terminationDate format');
    }

    // Get employee
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: companyId! },
    });
    if (!employee) return notFound('Employee not found');

    // Get company
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: {
        businessName: true,
        trnNumber: true,
        addressStreet: true,
        addressCity: true,
        addressParish: true,
      },
    });

    // Calculate fiscal year based on Jamaica's April-March cycle
    const fiscalYearStart = termDate.getMonth() >= 3
      ? new Date(termDate.getFullYear(), 3, 1) // April of same year
      : new Date(termDate.getFullYear() - 1, 3, 1); // April of prior year

    // Get all payroll entries for this employee from fiscal year start to termination
    const entries = await prisma.payrollEntry.findMany({
      where: {
        employeeId,
        payrollRun: {
          companyId: companyId!,
          status: { in: ['APPROVED', 'PAID'] },
          periodStart: { gte: fiscalYearStart },
          periodEnd: { lte: termDate },
        },
      },
      include: {
        payrollRun: { select: { periodStart: true, periodEnd: true, payDate: true } },
      },
      orderBy: { payrollRun: { periodStart: 'asc' } },
    });

    // Aggregate totals
    let totalGross = 0;
    let totalPAYE = 0;
    let totalNIS = 0;
    let totalNHT = 0;
    let totalEdTax = 0;
    let totalNet = 0;

    for (const entry of entries) {
      totalGross += Number(entry.grossPay);
      totalPAYE += Number(entry.paye);
      totalNIS += Number(entry.nis);
      totalNHT += Number(entry.nht);
      totalEdTax += Number(entry.educationTax);
      totalNet += Number(entry.netPay);
    }

    return NextResponse.json({
      formType: 'P45',
      generatedAt: new Date().toISOString(),
      employer: {
        name: company?.businessName,
        trn: company?.trnNumber,
        address: [company?.addressStreet, company?.addressCity, company?.addressParish].filter(Boolean).join(', '),
      },
      employee: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        trn: employee.trnNumber,
        nis: employee.nisNumber,
        position: employee.position,
        hireDate: employee.hireDate?.toISOString() ?? null,
        terminationDate: termDate.toISOString(),
      },
      fiscalYear: {
        start: fiscalYearStart.toISOString(),
        end: termDate.toISOString(),
      },
      earnings: {
        totalGross: round2(totalGross),
        totalPAYE: round2(totalPAYE),
        totalNIS: round2(totalNIS),
        totalNHT: round2(totalNHT),
        totalEdTax: round2(totalEdTax),
        totalNet: round2(totalNet),
        payPeriods: entries.length,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate P45');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
