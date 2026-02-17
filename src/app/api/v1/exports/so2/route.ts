/**
 * GET /api/v1/exports/so2
 * Generate SO2 Annual Payroll Return for TAJ.
 * Consolidates all S01 data for the fiscal year.
 * Due: March 31
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'tax:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const fiscalYear = parseInt(searchParams.get('fiscalYear') ?? '');
    const format = searchParams.get('format') ?? 'json';

    if (!fiscalYear) {
      return badRequest('fiscalYear is required (e.g., 2025)');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { businessName: true, trnNumber: true, fiscalYearEnd: true },
    });

    // Jamaica fiscal year: April 1 - March 31
    const yearStart = new Date(fiscalYear - 1, 3, 1); // April 1 of prior calendar year
    const yearEnd = new Date(fiscalYear, 2, 31, 23, 59, 59); // March 31

    // Get all approved/paid payroll entries for the fiscal year
    const entries = await prisma.payrollEntry.findMany({
      where: {
        payrollRun: {
          companyId: companyId!,
          status: { in: ['APPROVED', 'PAID'] },
          periodStart: { gte: yearStart },
          periodEnd: { lte: yearEnd },
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            trnNumber: true,
            nisNumber: true,
          },
        },
      },
    });

    // Aggregate per employee for the full year
    const employeeMap = new Map<string, AnnualEmployee>();

    for (const entry of entries) {
      let emp = employeeMap.get(entry.employeeId);
      if (!emp) {
        emp = {
          employeeId: entry.employeeId,
          firstName: entry.employee.firstName,
          lastName: entry.employee.lastName,
          trnNumber: entry.employee.trnNumber ?? '',
          nisNumber: entry.employee.nisNumber ?? '',
          totalGross: 0,
          totalPAYE: 0,
          totalNISEmployee: 0,
          totalNISEmployer: 0,
          totalNHTEmployee: 0,
          totalNHTEmployer: 0,
          totalEdTaxEmployee: 0,
          totalEdTaxEmployer: 0,
          totalHEART: 0,
          totalNet: 0,
        };
        employeeMap.set(entry.employeeId, emp);
      }

      emp.totalGross += Number(entry.grossPay);
      emp.totalPAYE += Number(entry.paye);
      emp.totalNISEmployee += Number(entry.nis);
      emp.totalNISEmployer += Number(entry.employerNis);
      emp.totalNHTEmployee += Number(entry.nht);
      emp.totalNHTEmployer += Number(entry.employerNht);
      emp.totalEdTaxEmployee += Number(entry.educationTax);
      emp.totalEdTaxEmployer += Number(entry.employerEducationTax);
      emp.totalHEART += Number(entry.heartContribution);
      emp.totalNet += Number(entry.netPay);
    }

    const employees = Array.from(employeeMap.values());

    const totals = {
      totalGross: round2(employees.reduce((s, e) => s + e.totalGross, 0)),
      totalPAYE: round2(employees.reduce((s, e) => s + e.totalPAYE, 0)),
      totalNIS: round2(employees.reduce((s, e) => s + e.totalNISEmployee + e.totalNISEmployer, 0)),
      totalNHT: round2(employees.reduce((s, e) => s + e.totalNHTEmployee + e.totalNHTEmployer, 0)),
      totalEdTax: round2(employees.reduce((s, e) => s + e.totalEdTaxEmployee + e.totalEdTaxEmployer, 0)),
      totalHEART: round2(employees.reduce((s, e) => s + e.totalHEART, 0)),
      totalNet: round2(employees.reduce((s, e) => s + e.totalNet, 0)),
    };

    if (format === 'txt') {
      const lines: string[] = [];
      lines.push(`H|${company?.trnNumber ?? ''}|${company?.businessName ?? ''}|${fiscalYear}|SO2`);
      for (const emp of employees) {
        lines.push([
          'D',
          emp.trnNumber,
          emp.nisNumber,
          emp.lastName,
          emp.firstName,
          round2(emp.totalGross).toFixed(2),
          round2(emp.totalPAYE).toFixed(2),
          round2(emp.totalNISEmployee).toFixed(2),
          round2(emp.totalNISEmployer).toFixed(2),
          round2(emp.totalNHTEmployee).toFixed(2),
          round2(emp.totalNHTEmployer).toFixed(2),
          round2(emp.totalEdTaxEmployee).toFixed(2),
          round2(emp.totalEdTaxEmployer).toFixed(2),
          round2(emp.totalHEART).toFixed(2),
        ].join('|'));
      }
      lines.push(`T|${employees.length}|${totals.totalPAYE.toFixed(2)}|${totals.totalNIS.toFixed(2)}`);

      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="SO2-${fiscalYear}.txt"`,
        },
      });
    }

    return NextResponse.json({
      formType: 'SO2',
      fiscalYear,
      period: { start: yearStart.toISOString(), end: yearEnd.toISOString() },
      dueDate: new Date(fiscalYear, 2, 31).toISOString(), // March 31
      companyTRN: company?.trnNumber ?? null,
      companyName: company?.businessName ?? null,
      employeeCount: employees.length,
      employees: employees.map((e) => ({
        ...e,
        totalGross: round2(e.totalGross),
        totalPAYE: round2(e.totalPAYE),
        totalNISEmployee: round2(e.totalNISEmployee),
        totalNISEmployer: round2(e.totalNISEmployer),
        totalNHTEmployee: round2(e.totalNHTEmployee),
        totalNHTEmployer: round2(e.totalNHTEmployer),
        totalEdTaxEmployee: round2(e.totalEdTaxEmployee),
        totalEdTaxEmployer: round2(e.totalEdTaxEmployer),
        totalHEART: round2(e.totalHEART),
        totalNet: round2(e.totalNet),
      })),
      totals,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate SO2 return');
  }
}

interface AnnualEmployee {
  employeeId: string;
  firstName: string;
  lastName: string;
  trnNumber: string;
  nisNumber: string;
  totalGross: number;
  totalPAYE: number;
  totalNISEmployee: number;
  totalNISEmployer: number;
  totalNHTEmployee: number;
  totalNHTEmployer: number;
  totalEdTaxEmployee: number;
  totalEdTaxEmployer: number;
  totalHEART: number;
  totalNet: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
