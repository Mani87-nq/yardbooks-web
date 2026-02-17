/**
 * GET /api/v1/exports/s01
 * Generate S01 Monthly Payroll Return for TAJ.
 * ASCII/Text delimited format for portal upload.
 * Per employee: PAYE, NIS (employee + employer), NHT, Education Tax
 * Due: 14th of following month
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
    const year = parseInt(searchParams.get('year') ?? '');
    const month = parseInt(searchParams.get('month') ?? '');
    const format = searchParams.get('format') ?? 'json'; // 'json' or 'txt'

    if (!year || !month || month < 1 || month > 12) {
      return badRequest('year and month (1-12) are required');
    }

    // Get company TRN
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { businessName: true, trnNumber: true },
    });

    // Date range for the month
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Get all payroll runs in the period
    const payrollRuns = await prisma.payrollRun.findMany({
      where: {
        companyId: companyId!,
        status: { in: ['APPROVED', 'PAID'] },
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
      include: {
        entries: {
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
        },
      },
    });

    // Aggregate per employee (may have multiple runs in a month)
    const employeeMap = new Map<string, EmployeeS01>();

    for (const run of payrollRuns) {
      for (const entry of run.entries) {
        let emp = employeeMap.get(entry.employeeId);
        if (!emp) {
          emp = {
            employeeId: entry.employeeId,
            firstName: entry.employee.firstName,
            lastName: entry.employee.lastName,
            trnNumber: entry.employee.trnNumber ?? '',
            nisNumber: entry.employee.nisNumber ?? '',
            grossPay: 0,
            paye: 0,
            nisEmployee: 0,
            nisEmployer: 0,
            nhtEmployee: 0,
            nhtEmployer: 0,
            educationTaxEmployee: 0,
            educationTaxEmployer: 0,
            heartContribution: 0,
            netPay: 0,
          };
          employeeMap.set(entry.employeeId, emp);
        }

        emp.grossPay += Number(entry.grossPay);
        emp.paye += Number(entry.paye);
        emp.nisEmployee += Number(entry.nis);
        emp.nisEmployer += Number(entry.employerNis);
        emp.nhtEmployee += Number(entry.nht);
        emp.nhtEmployer += Number(entry.employerNht);
        emp.educationTaxEmployee += Number(entry.educationTax);
        emp.educationTaxEmployer += Number(entry.employerEducationTax);
        emp.heartContribution += Number(entry.heartContribution);
        emp.netPay += Number(entry.netPay);
      }
    }

    const employees = Array.from(employeeMap.values());

    // Calculate totals
    const totals = {
      grossPay: round2(employees.reduce((s, e) => s + e.grossPay, 0)),
      paye: round2(employees.reduce((s, e) => s + e.paye, 0)),
      nisEmployee: round2(employees.reduce((s, e) => s + e.nisEmployee, 0)),
      nisEmployer: round2(employees.reduce((s, e) => s + e.nisEmployer, 0)),
      nhtEmployee: round2(employees.reduce((s, e) => s + e.nhtEmployee, 0)),
      nhtEmployer: round2(employees.reduce((s, e) => s + e.nhtEmployer, 0)),
      educationTaxEmployee: round2(employees.reduce((s, e) => s + e.educationTaxEmployee, 0)),
      educationTaxEmployer: round2(employees.reduce((s, e) => s + e.educationTaxEmployer, 0)),
      heartContribution: round2(employees.reduce((s, e) => s + e.heartContribution, 0)),
      netPay: round2(employees.reduce((s, e) => s + e.netPay, 0)),
    };

    const dueDate = new Date(year, month, 14); // 14th of following month

    // Text/ASCII delimited format for TAJ upload
    if (format === 'txt') {
      const lines: string[] = [];
      // Header
      lines.push(`H|${company?.trnNumber ?? ''}|${company?.businessName ?? ''}|${year}|${String(month).padStart(2, '0')}|S01`);
      // Detail lines
      for (const emp of employees) {
        lines.push([
          'D',
          emp.trnNumber,
          emp.nisNumber,
          emp.lastName,
          emp.firstName,
          round2(emp.grossPay).toFixed(2),
          round2(emp.paye).toFixed(2),
          round2(emp.nisEmployee).toFixed(2),
          round2(emp.nisEmployer).toFixed(2),
          round2(emp.nhtEmployee).toFixed(2),
          round2(emp.nhtEmployer).toFixed(2),
          round2(emp.educationTaxEmployee).toFixed(2),
          round2(emp.educationTaxEmployer).toFixed(2),
          round2(emp.heartContribution).toFixed(2),
        ].join('|'));
      }
      // Trailer
      lines.push(`T|${employees.length}|${totals.paye.toFixed(2)}|${totals.nisEmployee.toFixed(2)}|${totals.nisEmployer.toFixed(2)}`);

      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="S01-${year}-${String(month).padStart(2, '0')}.txt"`,
        },
      });
    }

    return NextResponse.json({
      formType: 'S01',
      period: { year, month, start: periodStart.toISOString(), end: periodEnd.toISOString() },
      dueDate: dueDate.toISOString(),
      companyTRN: company?.trnNumber ?? null,
      companyName: company?.businessName ?? null,
      employeeCount: employees.length,
      employees: employees.map((e) => ({
        ...e,
        grossPay: round2(e.grossPay),
        paye: round2(e.paye),
        nisEmployee: round2(e.nisEmployee),
        nisEmployer: round2(e.nisEmployer),
        nhtEmployee: round2(e.nhtEmployee),
        nhtEmployer: round2(e.nhtEmployer),
        educationTaxEmployee: round2(e.educationTaxEmployee),
        educationTaxEmployer: round2(e.educationTaxEmployer),
        heartContribution: round2(e.heartContribution),
        netPay: round2(e.netPay),
      })),
      totals,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate S01 return');
  }
}

interface EmployeeS01 {
  employeeId: string;
  firstName: string;
  lastName: string;
  trnNumber: string;
  nisNumber: string;
  grossPay: number;
  paye: number;
  nisEmployee: number;
  nisEmployer: number;
  nhtEmployee: number;
  nhtEmployer: number;
  educationTaxEmployee: number;
  educationTaxEmployer: number;
  heartContribution: number;
  netPay: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
