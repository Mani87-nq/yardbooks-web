/**
 * Leave tracking for Jamaica payroll.
 *
 * Manages employee leave balances (vacation, sick, maternity, paternity, personal)
 * with Jamaica labour-law defaults for entitlements.
 */
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const LEAVE_TYPES = [
  'VACATION',
  'SICK',
  'PERSONAL',
  'MATERNITY',
  'PATERNITY',
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export interface LeaveBalanceRecord {
  id: string;
  leaveType: string;
  yearStart: Date;
  yearEnd: Date;
  entitlement: number;
  used: number;
  pending: number;
  balance: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLeaveRecord(r: any): LeaveBalanceRecord {
  return {
    id: r.id,
    leaveType: r.leaveType,
    yearStart: r.yearStart,
    yearEnd: r.yearEnd,
    entitlement: Number(r.entitlement),
    used: Number(r.used),
    pending: Number(r.pending),
    balance: Number(r.balance),
  };
}

// ---------------------------------------------------------------------------
// Jamaica defaults
// ---------------------------------------------------------------------------

/**
 * Compute Jamaica statutory leave entitlement (in working days).
 *
 * - Vacation: 10 days/year (after 1 year of service), 15 days (after 5 years)
 * - Sick: 10 days/year
 * - Maternity: 8 weeks = 40 working days
 * - Paternity: 2 days
 * - Personal: 0 (no statutory requirement; companies may grant at discretion)
 */
export function getJamaicaEntitlement(
  leaveType: LeaveType,
  yearsOfService: number,
): number {
  switch (leaveType) {
    case 'VACATION':
      if (yearsOfService >= 5) return 15;
      if (yearsOfService >= 1) return 10;
      return 0;
    case 'SICK':
      return 10;
    case 'MATERNITY':
      return 40; // 8 weeks x 5 working days
    case 'PATERNITY':
      return 2;
    case 'PERSONAL':
      return 0;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Get the current leave balance for an employee and leave type.
 * Returns the balance record whose year range contains today, or null.
 */
export async function getLeaveBalance(
  employeeId: string,
  leaveType: string,
): Promise<LeaveBalanceRecord | null> {
  const today = new Date();
  const balance = await prisma.leaveBalance.findFirst({
    where: {
      employeeId,
      leaveType,
      yearStart: { lte: today },
      yearEnd: { gte: today },
    },
    orderBy: { yearStart: 'desc' },
  });

  return balance ? toLeaveRecord(balance) : null;
}

/**
 * Get all leave balances for an employee for the current year.
 */
export async function getAllLeaveBalances(
  employeeId: string,
): Promise<LeaveBalanceRecord[]> {
  const today = new Date();
  const records = await prisma.leaveBalance.findMany({
    where: {
      employeeId,
      yearStart: { lte: today },
      yearEnd: { gte: today },
    },
    orderBy: { leaveType: 'asc' },
  });
  return records.map(toLeaveRecord);
}

/**
 * Record leave usage for an employee. Deducts from the current-year balance.
 *
 * @param employeeId - The employee ID
 * @param leaveType  - Leave category (VACATION, SICK, etc.)
 * @param days       - Number of working days to deduct (must be > 0)
 * @returns The updated balance record
 * @throws Error if no balance exists, or insufficient balance
 */
export async function recordLeaveUsage(
  employeeId: string,
  leaveType: string,
  days: number,
): Promise<LeaveBalanceRecord> {
  if (days <= 0) {
    throw new Error('Days must be greater than 0');
  }

  const balance = await getLeaveBalance(employeeId, leaveType);
  if (!balance) {
    throw new Error(
      `No leave balance found for employee ${employeeId}, type ${leaveType}`,
    );
  }

  const currentBalance = Number(balance.balance);
  if (days > currentBalance) {
    throw new Error(
      `Insufficient leave balance: requested ${days} days, available ${currentBalance} days`,
    );
  }

  const newUsed = Number(balance.used) + days;
  const newBalance = Number(balance.entitlement) - newUsed - Number(balance.pending);

  const updated = await prisma.leaveBalance.update({
    where: { id: balance.id },
    data: {
      used: new Decimal(newUsed.toFixed(1)),
      balance: new Decimal(newBalance.toFixed(1)),
    },
  });

  return toLeaveRecord(updated);
}

/**
 * Initialize leave balances for a new employee for the current fiscal year.
 *
 * Creates balance records for each leave type using Jamaica statutory entitlements
 * based on the employee's years of service.
 *
 * @param employeeId - The employee ID
 * @param companyId  - The company ID
 * @returns Array of created balance records
 */
export async function initializeLeaveBalances(
  employeeId: string,
  companyId: string,
): Promise<LeaveBalanceRecord[]> {
  // Look up the employee to compute years of service
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { hireDate: true },
  });
  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  const now = new Date();
  const yearsOfService = Math.floor(
    (now.getTime() - employee.hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );

  // Use calendar year boundaries
  const yearStart = new Date(now.getFullYear(), 0, 1); // Jan 1
  const yearEnd = new Date(now.getFullYear(), 11, 31); // Dec 31

  const records: LeaveBalanceRecord[] = [];

  for (const leaveType of LEAVE_TYPES) {
    const entitlement = getJamaicaEntitlement(leaveType, yearsOfService);

    // Skip types with 0 entitlement
    if (entitlement === 0) continue;

    // Upsert so we don't fail on duplicate
    const record = await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveType_yearStart: {
          employeeId,
          leaveType,
          yearStart,
        },
      },
      update: {}, // No-op if already exists
      create: {
        companyId,
        employeeId,
        leaveType,
        yearStart,
        yearEnd,
        entitlement: new Decimal(entitlement.toFixed(1)),
        used: new Decimal('0.0'),
        pending: new Decimal('0.0'),
        balance: new Decimal(entitlement.toFixed(1)),
      },
    });

    records.push(toLeaveRecord(record));
  }

  return records;
}
