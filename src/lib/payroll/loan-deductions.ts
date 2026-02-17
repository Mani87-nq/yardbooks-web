/**
 * Loan / salary deduction management for Jamaica payroll.
 *
 * Supports company loans, NHT mortgage deductions, credit union,
 * court-ordered garnishments, and other recurring deductions.
 */
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const LOAN_TYPES = [
  'COMPANY_LOAN',
  'NHT_MORTGAGE',
  'CREDIT_UNION',
  'GARNISHMENT',
  'OTHER',
] as const;

export type LoanType = (typeof LOAN_TYPES)[number];

export interface DeductionSummary {
  type: string;
  description: string;
  amount: number;
}

export interface LoanDeductionRecord {
  id: string;
  loanType: string;
  description: string;
  principalAmount: number;
  monthlyDeduction: number;
  totalPaid: number;
  remainingBalance: number;
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLoanRecord(r: any): LoanDeductionRecord {
  return {
    id: r.id,
    loanType: r.loanType,
    description: r.description,
    principalAmount: Number(r.principalAmount),
    monthlyDeduction: Number(r.monthlyDeduction),
    totalPaid: Number(r.totalPaid),
    remainingBalance: Number(r.remainingBalance),
    isActive: r.isActive,
    startDate: r.startDate,
    endDate: r.endDate,
  };
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Get all active loan deductions for an employee.
 */
export async function getActiveDeductions(
  employeeId: string,
): Promise<LoanDeductionRecord[]> {
  const records = await prisma.loanDeduction.findMany({
    where: {
      employeeId,
      isActive: true,
    },
    orderBy: { startDate: 'asc' },
  });
  return records.map(toLoanRecord);
}

/**
 * Process a single loan deduction payment.
 *
 * Reduces the remaining balance and increments total paid.
 * If the remaining balance reaches zero the deduction is marked inactive.
 *
 * @param deductionId - The LoanDeduction record ID
 * @param amount      - Payment amount (must be > 0)
 * @returns The updated deduction record
 */
export async function processLoanDeduction(
  deductionId: string,
  amount: number,
): Promise<LoanDeductionRecord> {
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  const deduction = await prisma.loanDeduction.findUnique({
    where: { id: deductionId },
  });

  if (!deduction) {
    throw new Error(`Loan deduction ${deductionId} not found`);
  }
  if (!deduction.isActive) {
    throw new Error(`Loan deduction ${deductionId} is already inactive`);
  }

  const currentRemaining = Number(deduction.remainingBalance);
  // Don't overpay -- cap amount at remaining balance
  const effectiveAmount = Math.min(amount, currentRemaining);
  const newTotalPaid = Number(deduction.totalPaid) + effectiveAmount;
  const newRemaining = currentRemaining - effectiveAmount;

  const updated = await prisma.loanDeduction.update({
    where: { id: deductionId },
    data: {
      totalPaid: new Decimal(newTotalPaid.toFixed(2)),
      remainingBalance: new Decimal(newRemaining.toFixed(2)),
      isActive: newRemaining > 0,
    },
  });

  return toLoanRecord(updated);
}

/**
 * Calculate total monthly deductions for an employee across all active loans.
 *
 * Returns an itemised list suitable for payroll processing.
 */
export async function calculateAllDeductions(
  employeeId: string,
): Promise<DeductionSummary[]> {
  const activeDeductions = await getActiveDeductions(employeeId);

  return activeDeductions.map((d) => {
    // If remaining balance is less than the scheduled monthly deduction,
    // only deduct up to the remaining balance (final payment).
    const scheduled = Number(d.monthlyDeduction);
    const remaining = Number(d.remainingBalance);
    const amount = Math.min(scheduled, remaining);

    return {
      type: d.loanType,
      description: d.description,
      amount: Math.round(amount * 100) / 100,
    };
  });
}
