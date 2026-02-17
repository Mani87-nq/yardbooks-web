/**
 * GET /api/v1/exports/p2a
 * Generate P2A Employee Annual Earning Statements.
 * One statement per employee for the fiscal year.
 * Due: February 15 to employees
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
    const employeeId = searchParams.get('employeeId'); // Optional: single employee

    if (!fiscalYear) {
      return badRequest('fiscalYear is required');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { businessName: true, trnNumber: true, addressStreet: true, addressCity: true, addressParish: true },
    });

    const yearStart = new Date(fiscalYear - 1, 3, 1);
    const yearEnd = new Date(fiscalYear, 2, 31, 23, 59, 59);

    // Build where clause for entries
    const entryWhere: Record<string, unknown> = {
      payrollRun: {
        companyId: companyId!,
        status: { in: ['APPROVED', 'PAID'] },
        periodStart: { gte: yearStart },
        periodEnd: { lte: yearEnd },
      },
    };
    if (employeeId) {
      entryWhere.employeeId = employeeId;
    }

    const entries = await prisma.payrollEntry.findMany({
      where: entryWhere,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            trnNumber: true,
            nisNumber: true,
            email: true,
            position: true,
            hireDate: true,
          },
        },
        payrollRun: {
          select: { periodStart: true, periodEnd: true, payDate: true },
        },
      },
      orderBy: { payrollRun: { periodStart: 'asc' } },
    });

    // Aggregate per employee
    const employeeMap = new Map<string, P2AStatement>();

    for (const entry of entries) {
      let stmt = employeeMap.get(entry.employeeId);
      if (!stmt) {
        stmt = {
          employee: {
            id: entry.employee.id,
            firstName: entry.employee.firstName,
            lastName: entry.employee.lastName,
            trnNumber: entry.employee.trnNumber ?? '',
            nisNumber: entry.employee.nisNumber ?? '',
            email: entry.employee.email,
            position: entry.employee.position,
          },
          totalGross: 0,
          totalPAYE: 0,
          totalNIS: 0,
          totalNHT: 0,
          totalEdTax: 0,
          totalDeductions: 0,
          totalNet: 0,
          periods: [],
        };
        employeeMap.set(entry.employeeId, stmt);
      }

      stmt.totalGross += Number(entry.grossPay);
      stmt.totalPAYE += Number(entry.paye);
      stmt.totalNIS += Number(entry.nis);
      stmt.totalNHT += Number(entry.nht);
      stmt.totalEdTax += Number(entry.educationTax);
      stmt.totalDeductions += Number(entry.totalDeductions);
      stmt.totalNet += Number(entry.netPay);

      stmt.periods.push({
        periodStart: entry.payrollRun.periodStart.toISOString(),
        periodEnd: entry.payrollRun.periodEnd.toISOString(),
        gross: round2(Number(entry.grossPay)),
        paye: round2(Number(entry.paye)),
        nis: round2(Number(entry.nis)),
        nht: round2(Number(entry.nht)),
        edTax: round2(Number(entry.educationTax)),
        net: round2(Number(entry.netPay)),
      });
    }

    const statements = Array.from(employeeMap.values()).map((s) => ({
      ...s,
      totalGross: round2(s.totalGross),
      totalPAYE: round2(s.totalPAYE),
      totalNIS: round2(s.totalNIS),
      totalNHT: round2(s.totalNHT),
      totalEdTax: round2(s.totalEdTax),
      totalDeductions: round2(s.totalDeductions),
      totalNet: round2(s.totalNet),
    }));

    return NextResponse.json({
      formType: 'P2A',
      fiscalYear,
      dueDate: new Date(fiscalYear, 1, 15).toISOString(), // February 15
      company: {
        name: company?.businessName,
        trn: company?.trnNumber,
        address: [company?.addressStreet, company?.addressCity, company?.addressParish].filter(Boolean).join(', '),
      },
      statementCount: statements.length,
      statements,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate P2A statements');
  }
}

interface P2AStatement {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    trnNumber: string;
    nisNumber: string;
    email: string | null;
    position: string | null;
  };
  totalGross: number;
  totalPAYE: number;
  totalNIS: number;
  totalNHT: number;
  totalEdTax: number;
  totalDeductions: number;
  totalNet: number;
  periods: Array<{
    periodStart: string;
    periodEnd: string;
    gross: number;
    paye: number;
    nis: number;
    nht: number;
    edTax: number;
    net: number;
  }>;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
