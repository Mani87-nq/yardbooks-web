/**
 * GET  /api/v1/payroll/remittances — List statutory remittances
 * POST /api/v1/payroll/remittances — Generate remittance records from payroll runs
 *
 * Jamaica statutory deductions (PAYE, NIS, NHT, Education Tax, HEART/NTA)
 * must be remitted to the relevant government agencies monthly.
 *
 * Due dates:
 * - PAYE/NIS/NHT/Education Tax: 14th of the following month
 * - HEART/NTA: 14th of the following month
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

const REMITTANCE_TYPES = ['PAYE', 'NIS', 'NHT', 'EDUCATION_TAX', 'HEART_NTA'] as const;

// Field mapping from PayrollEntry to remittance type
const DEDUCTION_FIELDS: Record<string, { employee?: string; employer?: string }> = {
  PAYE: { employee: 'paye' },
  NIS: { employee: 'nis', employer: 'employerNis' },
  NHT: { employee: 'nht', employer: 'employerNht' },
  EDUCATION_TAX: { employee: 'educationTax', employer: 'employerEducationTax' },
  HEART_NTA: { employer: 'heartContribution' },
};

// ─── GET: List remittances ──────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    const where: any = { companyId: companyId! };
    if (status) where.status = status;
    if (year && month) {
      const periodStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const periodEnd = new Date(parseInt(year), parseInt(month), 0);
      where.periodMonth = { gte: periodStart, lte: periodEnd };
    } else if (year) {
      where.periodMonth = {
        gte: new Date(parseInt(year), 0, 1),
        lte: new Date(parseInt(year), 11, 31),
      };
    }

    const remittances = await prisma.statutoryRemittance.findMany({
      where,
      orderBy: [{ periodMonth: 'desc' }, { remittanceType: 'asc' }],
      include: { journalEntry: { select: { id: true, reference: true } } },
    });

    // Calculate summary
    const totalDue = remittances.reduce((sum, r) => sum + Number(r.amountDue), 0);
    const totalPaid = remittances.reduce((sum, r) => sum + Number(r.amountPaid), 0);
    const pending = remittances.filter(r => r.status === 'PENDING').length;
    const overdue = remittances.filter(r => r.status === 'OVERDUE').length;

    return NextResponse.json({
      data: remittances,
      summary: { totalDue, totalPaid, outstanding: totalDue - totalPaid, pending, overdue },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list remittances');
  }
}

// ─── POST: Generate remittance records for a month ──────────────

const generateSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid request. Provide year and month.');
    }

    const { year, month } = parsed.data;
    const periodMonth = new Date(year, month - 1, 1); // First of the month
    const periodStart = periodMonth;
    const periodEnd = new Date(year, month, 0); // Last day of the month

    // Due date: 14th of the following month
    const dueDate = new Date(year, month, 14);

    // Get all payroll entries for this month from APPROVED/PAID runs
    const entries = await prisma.payrollEntry.findMany({
      where: {
        payrollRun: {
          companyId: companyId!,
          periodStart: { gte: periodStart },
          periodEnd: { lte: periodEnd },
          status: { in: ['APPROVED', 'PAID'] },
        },
      },
      select: {
        paye: true,
        nis: true,
        nht: true,
        educationTax: true,
        employerNis: true,
        employerNht: true,
        employerEducationTax: true,
        heartContribution: true,
      },
    });

    if (entries.length === 0) {
      return badRequest('No approved payroll runs found for this period.');
    }

    // Aggregate totals per remittance type
    const totals: Record<string, number> = {};
    for (const type of REMITTANCE_TYPES) {
      const fields = DEDUCTION_FIELDS[type];
      let total = 0;
      for (const entry of entries) {
        if (fields.employee) {
          total += Number((entry as any)[fields.employee] ?? 0);
        }
        if (fields.employer) {
          total += Number((entry as any)[fields.employer] ?? 0);
        }
      }
      totals[type] = Math.round(total * 100) / 100;
    }

    // Create or update remittance records (upsert for idempotency)
    const created = [];
    for (const type of REMITTANCE_TYPES) {
      if (totals[type] <= 0) continue;

      const remittance = await prisma.statutoryRemittance.upsert({
        where: {
          companyId_remittanceType_periodMonth: {
            companyId: companyId!,
            remittanceType: type,
            periodMonth,
          },
        },
        create: {
          companyId: companyId!,
          remittanceType: type,
          periodMonth,
          amountDue: totals[type],
          dueDate,
          status: new Date() > dueDate ? 'OVERDUE' : 'PENDING',
          createdBy: user!.sub,
        },
        update: {
          amountDue: totals[type],
          // Don't overwrite status if already PAID
        },
      });

      created.push(remittance);
    }

    return NextResponse.json({
      data: created,
      period: `${year}-${String(month).padStart(2, '0')}`,
      entriesProcessed: entries.length,
    }, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate remittances');
  }
}
