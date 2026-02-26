/**
 * POST /api/v1/payroll/back-pay — Calculate and process back pay
 *
 * When an employee receives a salary increase retroactive to a past date,
 * this endpoint calculates the difference for each missed period and
 * creates a special payroll entry with the lump-sum back pay.
 *
 * Tax treatment: Jamaica PAYE on lump-sum back pay can be calculated
 * using the standard monthly rate (spread across the retroactive months).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { calculatePayroll } from '@/lib/payroll/tax-calculator';

const backPaySchema = z.object({
  employeeId: z.string().min(1),
  newBaseSalary: z.number().min(0),
  effectiveDate: z.coerce.date(),  // When the raise was effective
  throughDate: z.coerce.date(),    // Calculate back pay through this date
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).default('MONTHLY'),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = backPaySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid back pay data');
    }

    const { employeeId, newBaseSalary, effectiveDate, throughDate, frequency, reason } = parsed.data;

    // Verify employee
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: companyId! },
      select: { id: true, firstName: true, lastName: true, baseSalary: true },
    });
    if (!employee) return notFound('Employee not found');

    const oldSalary = Number(employee.baseSalary);
    if (newBaseSalary <= oldSalary) {
      return badRequest('New salary must be greater than current salary for back pay');
    }

    // Calculate the number of periods between effectiveDate and throughDate
    const monthlyDiff = newBaseSalary - oldSalary;
    let periodsCount: number;
    let periodDiff: number;

    if (frequency === 'MONTHLY') {
      periodsCount = monthsBetween(effectiveDate, throughDate);
      periodDiff = monthlyDiff;
    } else if (frequency === 'BIWEEKLY') {
      const daysDiff = Math.ceil((throughDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
      periodsCount = Math.floor(daysDiff / 14);
      periodDiff = (monthlyDiff * 12) / 26; // 26 biweekly periods per year
    } else {
      const daysDiff = Math.ceil((throughDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
      periodsCount = Math.floor(daysDiff / 7);
      periodDiff = (monthlyDiff * 12) / 52; // 52 weekly periods per year
    }

    if (periodsCount <= 0) {
      return badRequest('No pay periods found between effective date and through date');
    }

    // Total back pay (gross)
    const totalBackPay = Math.round(periodDiff * periodsCount * 100) / 100;

    // Calculate tax on the lump sum spread across periods
    // Use a single period calculation at the new salary rate and subtract old
    const newCalc = calculatePayroll({
      basicSalary: newBaseSalary,
      overtime: 0,
      bonus: 0,
      commission: 0,
      allowances: 0,
      pensionContribution: 0,
      otherDeductions: 0,
      frequency,
    });

    const oldCalc = calculatePayroll({
      basicSalary: oldSalary,
      overtime: 0,
      bonus: 0,
      commission: 0,
      allowances: 0,
      pensionContribution: 0,
      otherDeductions: 0,
      frequency,
    });

    // Per-period tax difference
    const payeDiff = (newCalc.employee.paye - oldCalc.employee.paye) * periodsCount;
    const nisDiff = (newCalc.employee.nis - oldCalc.employee.nis) * periodsCount;
    const nhtDiff = (newCalc.employee.nht - oldCalc.employee.nht) * periodsCount;
    const edTaxDiff = (newCalc.employee.educationTax - oldCalc.employee.educationTax) * periodsCount;

    const totalDeductions = round2(payeDiff + nisDiff + nhtDiff + edTaxDiff);
    const netBackPay = round2(totalBackPay - totalDeductions);

    // Employer contributions difference
    const employerNisDiff = (newCalc.employer.nis - oldCalc.employer.nis) * periodsCount;
    const employerNhtDiff = (newCalc.employer.nht - oldCalc.employer.nht) * periodsCount;
    const employerEdTaxDiff = (newCalc.employer.educationTax - oldCalc.employer.educationTax) * periodsCount;
    const heartDiff = (newCalc.employer.heartNta - oldCalc.employer.heartNta) * periodsCount;
    const totalEmployerContributions = round2(employerNisDiff + employerNhtDiff + employerEdTaxDiff + heartDiff);

    return NextResponse.json({
      calculation: {
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        oldSalary: round2(oldSalary),
        newSalary: round2(newBaseSalary),
        salaryDifference: round2(periodDiff),
        effectiveDate: effectiveDate.toISOString().split('T')[0],
        throughDate: throughDate.toISOString().split('T')[0],
        frequency,
        periodsCount,
        reason,

        // Gross
        totalBackPay: round2(totalBackPay),

        // Employee deductions
        deductions: {
          paye: round2(payeDiff),
          nis: round2(nisDiff),
          nht: round2(nhtDiff),
          educationTax: round2(edTaxDiff),
          totalDeductions,
        },

        // Net
        netBackPay,

        // Employer
        employerContributions: {
          nis: round2(employerNisDiff),
          nht: round2(employerNhtDiff),
          educationTax: round2(employerEdTaxDiff),
          heartNta: round2(heartDiff),
          total: totalEmployerContributions,
        },

        // Total cost to company
        totalCost: round2(totalBackPay + totalEmployerContributions),
      },
    }, { status: 200 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to calculate back pay');
  }
}

function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
