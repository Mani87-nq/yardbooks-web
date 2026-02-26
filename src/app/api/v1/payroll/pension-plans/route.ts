/**
 * GET  /api/v1/payroll/pension-plans — List pension plans for the company
 * POST /api/v1/payroll/pension-plans — Create a new pension plan
 *
 * Jamaica approved pension plans qualify for tax relief under the Income Tax Act:
 * Employee contributions to approved plans are deducted before PAYE calculation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ─── GET: List pension plans ──────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const plans = await prisma.pensionPlan.findMany({
      where: { companyId: companyId! },
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: plans.map(p => ({
        id: p.id,
        name: p.name,
        providerName: p.providerName,
        policyNumber: p.policyNumber,
        employeeRate: Number(p.employeeRate),
        employerRate: Number(p.employerRate),
        isApproved: p.isApproved,
        isActive: p.isActive,
        enrolledEmployees: p._count.employees,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list pension plans');
  }
}

// ─── POST: Create pension plan ────────────────────────────────────

const pensionPlanSchema = z.object({
  name: z.string().min(1).max(200),
  providerName: z.string().max(200).optional(),
  policyNumber: z.string().max(100).optional(),
  employeeRate: z.number().min(0).max(0.25), // 0-25%
  employerRate: z.number().min(0).max(0.25),
  isApproved: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = pensionPlanSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid pension plan data');
    }

    const plan = await prisma.pensionPlan.create({
      data: {
        companyId: companyId!,
        name: parsed.data.name,
        providerName: parsed.data.providerName,
        policyNumber: parsed.data.policyNumber,
        employeeRate: parsed.data.employeeRate,
        employerRate: parsed.data.employerRate,
        isApproved: parsed.data.isApproved,
      },
    });

    return NextResponse.json({
      data: {
        id: plan.id,
        name: plan.name,
        providerName: plan.providerName,
        policyNumber: plan.policyNumber,
        employeeRate: Number(plan.employeeRate),
        employerRate: Number(plan.employerRate),
        isApproved: plan.isApproved,
        isActive: plan.isActive,
      },
      message: `Pension plan "${plan.name}" created successfully`,
    }, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create pension plan');
  }
}
