/**
 * Overtime calculator for Jamaica payroll.
 *
 * Handles regular hours, overtime (1.5x), and holiday pay (2x).
 * Includes Jamaica minimum wage compliance check.
 */

export interface OvertimeConfig {
  standardHoursPerWeek: number; // Default: 40
  standardRate: number; // Regular hourly rate (JMD)
  overtimeMultiplier: number; // Default: 1.5
  holidayMultiplier: number; // Default: 2.0
}

export interface OvertimeCalculation {
  regularHours: number;
  regularPay: number;
  overtimeHours: number;
  overtimePay: number;
  holidayHours: number;
  holidayPay: number;
  totalHours: number;
  totalPay: number;
}

/**
 * Default overtime configuration per Jamaica labour law.
 */
export const DEFAULT_OVERTIME_CONFIG: Partial<OvertimeConfig> = {
  standardHoursPerWeek: 40,
  overtimeMultiplier: 1.5,
  holidayMultiplier: 2.0,
};

/**
 * Calculate overtime pay breakdown for a given number of hours worked in one week.
 *
 * Hours are allocated in this priority:
 * 1. Holiday hours (paid at holidayMultiplier)
 * 2. Regular hours up to the standard weekly limit
 * 3. Remaining hours as overtime (paid at overtimeMultiplier)
 *
 * @param hoursWorked - Total hours worked in the week (must be >= 0)
 * @param config      - Pay configuration with rates and multipliers
 * @param holidayHours - Hours worked on public holidays (subset of hoursWorked), default 0
 */
export function calculateOvertime(
  hoursWorked: number,
  config: OvertimeConfig,
  holidayHours: number = 0,
): OvertimeCalculation {
  if (hoursWorked < 0) {
    throw new Error('hoursWorked must be >= 0');
  }
  if (holidayHours < 0) {
    throw new Error('holidayHours must be >= 0');
  }
  if (holidayHours > hoursWorked) {
    throw new Error('holidayHours cannot exceed hoursWorked');
  }

  const {
    standardHoursPerWeek,
    standardRate,
    overtimeMultiplier,
    holidayMultiplier,
  } = config;

  // Holiday hours are paid at the holiday rate regardless of total hours
  const effectiveHolidayHours = holidayHours;
  const holidayPay = effectiveHolidayHours * standardRate * holidayMultiplier;

  // Non-holiday hours are split into regular + overtime
  const nonHolidayHours = hoursWorked - effectiveHolidayHours;
  const regularHours = Math.min(nonHolidayHours, standardHoursPerWeek);
  const overtimeHours = Math.max(nonHolidayHours - standardHoursPerWeek, 0);

  const regularPay = regularHours * standardRate;
  const overtimePay = overtimeHours * standardRate * overtimeMultiplier;

  return {
    regularHours: round2(regularHours),
    regularPay: round2(regularPay),
    overtimeHours: round2(overtimeHours),
    overtimePay: round2(overtimePay),
    holidayHours: round2(effectiveHolidayHours),
    holidayPay: round2(holidayPay),
    totalHours: round2(hoursWorked),
    totalPay: round2(regularPay + overtimePay + holidayPay),
  };
}

/**
 * Jamaica minimum wage compliance check.
 *
 * As of 2024 the national minimum wage is JMD 16,000 per 40-hour week,
 * which equates to JMD 400 per hour.
 */
export function checkMinimumWage(hourlyRate: number): {
  compliant: boolean;
  minimumRate: number;
} {
  const MINIMUM_HOURLY_RATE = 400; // JMD per hour
  return {
    compliant: hourlyRate >= MINIMUM_HOURLY_RATE,
    minimumRate: MINIMUM_HOURLY_RATE,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
