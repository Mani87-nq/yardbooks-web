/**
 * Jamaica Gratuity / Severance Calculator
 *
 * Under the Jamaica Employment (Termination and Redundancy Payments) Act:
 * - Employees are entitled to redundancy pay after 2 years of service
 * - Rate: 2 weeks' basic pay per year of service
 * - Maximum: 5 years (i.e., max 10 weeks of pay)
 * - Pro-rated for partial years of service
 *
 * Gratuity may also apply to resignation/retirement based on company policy.
 *
 * Sources:
 * - Employment (Termination and Redundancy Payments) Act, Jamaica
 * - Ministry of Labour and Social Security guidelines
 */

export interface GratuityInput {
  /** Base salary (period amount) */
  baseSalary: number;
  /** Payment frequency to derive weekly rate */
  paymentFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  /** Employee hire date */
  hireDate: Date;
  /** Termination/calculation date (defaults to today) */
  terminationDate?: Date;
  /** Reason for separation */
  reason: 'REDUNDANCY' | 'RESIGNATION' | 'RETIREMENT' | 'TERMINATION' | 'ESTIMATE';
}

export interface GratuityResult {
  /** Whether the employee is eligible for gratuity */
  eligible: boolean;
  /** Reason for ineligibility (if applicable) */
  ineligibleReason?: string;
  /** Years of completed service */
  yearsOfService: number;
  /** Capped years used for calculation (max 5) */
  cappedYears: number;
  /** Weekly rate derived from salary */
  weeklyRate: number;
  /** Weeks of pay entitled (2 per year, max 10) */
  weeksEntitled: number;
  /** Total gratuity amount */
  amount: number;
  /** Breakdown for transparency */
  breakdown: string;
}

// ─── Constants ──────────────────────────────────────────────────

/** Weeks of pay per year of service */
const WEEKS_PER_YEAR = 2;

/** Maximum years of service for gratuity calculation */
const MAX_YEARS = 5;

/** Maximum weeks of gratuity pay */
const MAX_WEEKS = WEEKS_PER_YEAR * MAX_YEARS; // 10 weeks

/** Minimum years of service for redundancy eligibility */
const MIN_YEARS_FOR_REDUNDANCY = 2;

/** Approximate weeks per month */
const WEEKS_PER_MONTH = 4.333;

// ─── Calculator ──────────────────────────────────────────────────

/**
 * Calculate the weekly rate from the employee's salary and frequency.
 */
function getWeeklyRate(baseSalary: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return baseSalary;
    case 'BIWEEKLY':
      return baseSalary / 2;
    case 'MONTHLY':
      return baseSalary / WEEKS_PER_MONTH;
    default:
      return baseSalary / WEEKS_PER_MONTH;
  }
}

/**
 * Calculate years of service including fractional years.
 */
function calculateYearsOfService(hireDate: Date, endDate: Date): number {
  const diffMs = endDate.getTime() - hireDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays / 365.25;
}

/**
 * Calculate gratuity/severance payment for a Jamaica employee.
 */
export function calculateGratuity(input: GratuityInput): GratuityResult {
  const terminationDate = input.terminationDate ?? new Date();
  const yearsOfService = calculateYearsOfService(input.hireDate, terminationDate);
  const weeklyRate = Math.round(getWeeklyRate(input.baseSalary, input.paymentFrequency) * 100) / 100;

  // Check eligibility
  if (yearsOfService < 0) {
    return {
      eligible: false,
      ineligibleReason: 'Termination date is before hire date',
      yearsOfService: 0,
      cappedYears: 0,
      weeklyRate,
      weeksEntitled: 0,
      amount: 0,
      breakdown: 'Invalid dates',
    };
  }

  // For redundancy, minimum 2 years required
  if (input.reason === 'REDUNDANCY' && yearsOfService < MIN_YEARS_FOR_REDUNDANCY) {
    return {
      eligible: false,
      ineligibleReason: `Redundancy pay requires at least ${MIN_YEARS_FOR_REDUNDANCY} years of service. Employee has ${yearsOfService.toFixed(1)} years.`,
      yearsOfService: Math.round(yearsOfService * 10) / 10,
      cappedYears: 0,
      weeklyRate,
      weeksEntitled: 0,
      amount: 0,
      breakdown: `${yearsOfService.toFixed(1)} years of service (minimum ${MIN_YEARS_FOR_REDUNDANCY} required for redundancy)`,
    };
  }

  // Cap at MAX_YEARS
  const cappedYears = Math.min(yearsOfService, MAX_YEARS);

  // Calculate weeks entitled (pro-rated for partial years)
  const weeksEntitled = Math.min(
    Math.round(cappedYears * WEEKS_PER_YEAR * 100) / 100,
    MAX_WEEKS
  );

  // Calculate amount
  const amount = Math.round(weeklyRate * weeksEntitled * 100) / 100;

  const breakdown = [
    `Service: ${yearsOfService.toFixed(2)} years${yearsOfService > MAX_YEARS ? ` (capped at ${MAX_YEARS})` : ''}`,
    `Weekly rate: J$${weeklyRate.toLocaleString()}`,
    `Weeks entitled: ${weeksEntitled.toFixed(2)} (${WEEKS_PER_YEAR} weeks x ${cappedYears.toFixed(2)} years)`,
    `Gratuity: J$${amount.toLocaleString()}`,
  ].join(' | ');

  return {
    eligible: true,
    yearsOfService: Math.round(yearsOfService * 100) / 100,
    cappedYears: Math.round(cappedYears * 100) / 100,
    weeklyRate,
    weeksEntitled,
    amount,
    breakdown,
  };
}

/**
 * Calculate estimated annual gratuity accrual for an active employee.
 * Useful for budgeting and provisioning.
 */
export function estimateAnnualGratuityAccrual(
  baseSalary: number,
  paymentFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
  yearsOfService: number
): number {
  // If already at max years, no additional accrual needed
  if (yearsOfService >= MAX_YEARS) return 0;

  const weeklyRate = getWeeklyRate(baseSalary, paymentFrequency);
  // Annual accrual = 2 weeks of pay per year
  return Math.round(weeklyRate * WEEKS_PER_YEAR * 100) / 100;
}
