/**
 * GET/POST /api/v1/employees/[id]/loans
 *
 * GET  - Retrieve active loan deductions for the employee (payroll:read)
 * POST - Create a new loan deduction                      (payroll:create)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import {
  getActiveDeductions,
  calculateAllDeductions,
  LOAN_TYPES,
} from '@/lib/payroll/loan-deductions';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET - list active loan deductions (with optional summary)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify employee belongs to the company
    const employee = await prisma.employee.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      select: { id: true },
    });
    if (!employee) return notFound('Employee not found');

    const deductions = await getActiveDeductions(id);
    const summary = await calculateAllDeductions(id);
    const totalMonthlyDeduction = summary.reduce((sum, d) => sum + Number(d.amount || 0), 0);

    return NextResponse.json({
      employeeId: id,
      deductions,
      summary,
      totalMonthlyDeduction: Math.round(totalMonthlyDeduction * 100) / 100,
    });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to get loan deductions',
    );
  }
}

// ---------------------------------------------------------------------------
// POST - create a new loan deduction
// ---------------------------------------------------------------------------

const createLoanSchema = z.object({
  loanType: z.enum(LOAN_TYPES as unknown as [string, ...string[]]),
  description: z.string().min(1).max(255),
  principalAmount: z.number().positive(),
  monthlyDeduction: z.number().positive(),
  startDate: z.string().date(), // ISO date string e.g. "2025-06-01"
  endDate: z.string().date().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'payroll:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify employee belongs to the company
    const employee = await prisma.employee.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      select: { id: true },
    });
    if (!employee) return notFound('Employee not found');

    const body = await request.json();
    const parsed = createLoanSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Validation failed: check loanType, description, principalAmount, monthlyDeduction, and startDate');
    }

    const {
      loanType,
      description,
      principalAmount,
      monthlyDeduction,
      startDate,
      endDate,
    } = parsed.data;

    if (monthlyDeduction > principalAmount) {
      return badRequest('monthlyDeduction cannot exceed principalAmount');
    }

    const deduction = await prisma.loanDeduction.create({
      data: {
        companyId: companyId!,
        employeeId: id,
        loanType,
        description,
        principalAmount: new Decimal(principalAmount.toFixed(2)),
        monthlyDeduction: new Decimal(monthlyDeduction.toFixed(2)),
        totalPaid: new Decimal('0.00'),
        remainingBalance: new Decimal(principalAmount.toFixed(2)),
        isActive: true,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    return NextResponse.json(deduction, { status: 201 });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to create loan deduction',
    );
  }
}
