/**
 * GET/POST /api/v1/fiscal-periods
 * Manage accounting periods.
 * Period states: FUTURE → OPEN → SOFT_LOCKED → LOCKED → CLOSED
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'gl:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const fiscalYear = searchParams.get('fiscalYear');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { companyId: companyId! };
    if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);
    if (status) where.status = status;

    const periods = await prisma.accountingPeriod.findMany({
      where,
      orderBy: [{ fiscalYear: 'asc' }, { periodNumber: 'asc' }],
    });

    return NextResponse.json({ data: periods });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list fiscal periods');
  }
}

const createPeriodsSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2100),
  periodType: z.enum(['MONTHLY', 'QUARTERLY']).default('MONTHLY'),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'gl:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createPeriodsSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { fiscalYear, periodType } = parsed.data;

    // Check if periods already exist for this year
    const existing = await prisma.accountingPeriod.count({
      where: { companyId: companyId!, fiscalYear },
    });
    if (existing > 0) {
      return badRequest(`Periods already exist for fiscal year ${fiscalYear}`);
    }

    // Get company fiscal year end month
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { fiscalYearEnd: true },
    });
    const fyEndMonth = company?.fiscalYearEnd ?? 3; // Default March

    // Generate periods
    const periodsToCreate = periodType === 'MONTHLY' ? 12 : 4;
    const monthsPerPeriod = periodType === 'MONTHLY' ? 1 : 3;

    const periods = [];
    for (let i = 0; i < periodsToCreate; i++) {
      // Fiscal year starts the month after fiscal year end
      const startMonth = (fyEndMonth % 12) + (i * monthsPerPeriod);
      const startYear = fiscalYear - 1 + Math.floor((fyEndMonth + (i * monthsPerPeriod)) / 12);
      const startDate = new Date(startYear, startMonth, 1);

      const endMonth = startMonth + monthsPerPeriod;
      const endYear = startYear + Math.floor(endMonth / 12);
      const endDate = new Date(endYear, endMonth % 12, 0); // Last day

      periods.push({
        companyId: companyId!,
        periodNumber: i + 1,
        fiscalYear,
        periodType,
        startDate,
        endDate,
        status: i === 0 ? 'OPEN' as const : 'FUTURE' as const,
      });
    }

    const created = await prisma.accountingPeriod.createMany({
      data: periods,
    });

    return NextResponse.json({
      created: created.count,
      fiscalYear,
      periodType,
    }, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create fiscal periods');
  }
}
