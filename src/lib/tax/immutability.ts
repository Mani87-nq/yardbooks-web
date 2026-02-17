/**
 * Financial Data Immutability Layer
 *
 * Enforces immutability at the application level:
 * - Prevents modification of posted journal entries
 * - Prevents journal entries in closed/locked periods
 * - Requires void/reversal workflows instead of modification
 *
 * Note: PostgreSQL-level triggers should also be set up via migration
 * for defense-in-depth. This module provides the application-layer checks.
 */

import prisma from '@/lib/db';

export type PeriodCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Check if a journal entry can be created/modified for a given date.
 * Blocks entries in LOCKED or CLOSED periods.
 */
export async function checkPeriodAllowsEntry(
  companyId: string,
  entryDate: Date,
  options?: { allowSoftLocked?: boolean }
): Promise<PeriodCheckResult> {
  // Find the period that contains this date
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      companyId,
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
    },
  });

  // If no period exists, allow (periods haven't been set up yet)
  if (!period) {
    return { allowed: true };
  }

  const blockedStatuses = ['LOCKED', 'CLOSED'];
  if (!options?.allowSoftLocked) {
    // SOFT_LOCKED still allows certain entries (adjustments by accountants)
  }

  if (blockedStatuses.includes(period.status)) {
    return {
      allowed: false,
      reason: `Period ${period.periodNumber} (FY ${period.fiscalYear}) is ${period.status}. Journal entries cannot be created or modified in ${period.status} periods.`,
    };
  }

  if (period.status === 'FUTURE') {
    return {
      allowed: false,
      reason: `Period ${period.periodNumber} (FY ${period.fiscalYear}) is not yet open. Open the period before creating entries.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if a posted journal entry can be modified.
 * Posted entries should NEVER be directly modified — use void/reversal instead.
 */
export function checkEntryModifiable(status: string): PeriodCheckResult {
  if (status === 'POSTED') {
    return {
      allowed: false,
      reason: 'Posted journal entries cannot be modified. Use void or reversal instead.',
    };
  }
  if (status === 'REVERSED') {
    return {
      allowed: false,
      reason: 'Reversed journal entries cannot be modified.',
    };
  }
  if (status === 'VOID') {
    return {
      allowed: false,
      reason: 'Voided journal entries cannot be modified.',
    };
  }

  return { allowed: true };
}

/**
 * Check if a financial document can be deleted.
 * Financial documents with GL entries should never be hard-deleted.
 */
export function checkDeletionAllowed(params: {
  hasJournalEntry: boolean;
  status: string;
}): PeriodCheckResult {
  if (params.hasJournalEntry) {
    return {
      allowed: false,
      reason: 'Documents with associated journal entries cannot be deleted. Use void or credit note instead.',
    };
  }

  if (['PAID', 'PARTIAL'].includes(params.status)) {
    return {
      allowed: false,
      reason: 'Documents with payments cannot be deleted. Use credit note instead.',
    };
  }

  return { allowed: true };
}

/**
 * Validate that debits equal credits in a set of journal lines.
 * This is the fundamental accounting equation check.
 */
export function validateDebitsCreditBalance(
  lines: Array<{ debitAmount: number; creditAmount: number }>
): PeriodCheckResult {
  const totalDebits = lines.reduce((sum, l) => sum + l.debitAmount, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.creditAmount, 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    return {
      allowed: false,
      reason: `Debits ($${totalDebits.toFixed(2)}) do not equal credits ($${totalCredits.toFixed(2)}). Difference: $${Math.abs(totalDebits - totalCredits).toFixed(2)}`,
    };
  }

  return { allowed: true };
}
