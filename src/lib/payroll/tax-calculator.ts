/**
 * Jamaica Payroll Tax Calculator
 *
 * Calculates statutory deductions for Jamaican employees.
 * Rates effective April 2026 (Fiscal Year 2026/2027).
 *
 * DEDUCTION ORDER (critical — per Jamaica tax law):
 * 1. NIS (on gross, capped)
 * 2. Approved pension contributions (if any)
 * 3. Education Tax (on statutory income: gross - NIS - pension)
 * 4. NHT (on gross)
 * 5. PAYE (on chargeable income: gross - NIS - pension - threshold)
 *
 * Sources:
 * - Finance Minister Fayval Williams, Budget 2025/2026
 * - PWC Jamaica Tax Summaries 2026
 * - Tax Administration Jamaica (TAJ)
 */

// ─── Jamaica Tax Constants (FY 2026/2027) ────────────────────────

export const JAMAICA_TAX_RATES = {
  // PAYE (Pay As You Earn)
  PAYE_THRESHOLD_ANNUAL: 1_902_360,         // J$ per year (effective April 2026)
  PAYE_THRESHOLD_MONTHLY: 158_530,           // J$ per month
  PAYE_THRESHOLD_BIWEEKLY: 73_168,           // J$ per bi-weekly period
  PAYE_THRESHOLD_WEEKLY: 36_584,             // J$ per week
  PAYE_RATE_1: 0.25,                         // 25% on first J$6M
  PAYE_RATE_2: 0.30,                         // 30% above J$6M
  PAYE_BRACKET_1_ANNUAL: 6_000_000,          // J$ annual bracket boundary
  PAYE_BRACKET_1_MONTHLY: 500_000,           // J$ monthly bracket boundary

  // NIS (National Insurance Scheme)
  NIS_EMPLOYEE_RATE: 0.03,                   // 3% employee
  NIS_EMPLOYER_RATE: 0.03,                   // 3% employer
  NIS_ANNUAL_CEILING: 5_000_000,             // J$ insurable wage ceiling
  NIS_MONTHLY_CEILING: 416_667,              // J$ monthly ceiling
  NIS_MAX_ANNUAL_CONTRIBUTION: 150_000,      // J$5M * 3% = J$150,000/yr
  NIS_MAX_MONTHLY_CONTRIBUTION: 12_500,      // J$150,000 / 12

  // NHT (National Housing Trust)
  NHT_EMPLOYEE_RATE: 0.02,                   // 2% employee
  NHT_EMPLOYER_RATE: 0.03,                   // 3% employer

  // Education Tax
  EDUCATION_TAX_EMPLOYEE_RATE: 0.0225,       // 2.25% employee
  EDUCATION_TAX_EMPLOYER_RATE: 0.035,        // 3.5% employer

  // HEART/NTA (employer only)
  HEART_NTA_RATE: 0.03,                      // 3% employer only
} as const;

// ─── Types ───────────────────────────────────────────────────────

export type PaymentFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface PayrollInput {
  basicSalary: number;              // Period salary (monthly/bi-weekly/weekly)
  overtime: number;                 // Overtime earnings for period
  bonus: number;                    // Bonus for period
  commission: number;               // Commission for period
  allowances: number;               // Allowances for period (taxable by default)
  nonTaxableAllowances?: number;    // Non-taxable portion of allowances (travel/meal/laundry)
  pensionContribution: number;      // Employee approved pension contribution
  otherDeductions: number;          // Other non-statutory deductions (loans, etc.)
  frequency: PaymentFrequency;
  ytdGross?: number;                // Year-to-date gross (for NIS ceiling tracking)
  ytdNis?: number;                  // Year-to-date NIS paid (for ceiling tracking)
}

export interface EmployeeDeductions {
  nis: number;
  nht: number;
  educationTax: number;
  paye: number;
  pension: number;
  otherDeductions: number;
  totalDeductions: number;
}

export interface EmployerContributions {
  nis: number;
  nht: number;
  educationTax: number;
  heartNta: number;
  total: number;
}

export interface PayrollCalculation {
  grossPay: number;
  taxableGross: number;       // Gross minus non-taxable allowances
  statutoryIncome: number;    // For Education Tax: gross - NIS - pension
  chargeableIncome: number;   // For PAYE: gross - NIS - pension - threshold
  employee: EmployeeDeductions;
  employer: EmployerContributions;
  netPay: number;
}

// ─── Helper: Get periods per year ────────────────────────────────

function getPeriodsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'WEEKLY': return 52;
    case 'BIWEEKLY': return 26;
    case 'MONTHLY': return 12;
  }
}

function getPayeThreshold(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'WEEKLY': return JAMAICA_TAX_RATES.PAYE_THRESHOLD_WEEKLY;
    case 'BIWEEKLY': return JAMAICA_TAX_RATES.PAYE_THRESHOLD_BIWEEKLY;
    case 'MONTHLY': return JAMAICA_TAX_RATES.PAYE_THRESHOLD_MONTHLY;
  }
}

function getPayeBracket1(frequency: PaymentFrequency): number {
  const periodsPerYear = getPeriodsPerYear(frequency);
  return JAMAICA_TAX_RATES.PAYE_BRACKET_1_ANNUAL / periodsPerYear;
}

function getNisCeiling(frequency: PaymentFrequency): number {
  const periodsPerYear = getPeriodsPerYear(frequency);
  return JAMAICA_TAX_RATES.NIS_ANNUAL_CEILING / periodsPerYear;
}

// ─── Main Calculator ─────────────────────────────────────────────

/**
 * Calculates all payroll deductions for a single employee for one pay period.
 *
 * Follows Jamaica tax law deduction order:
 * 1. NIS first (capped at ceiling)
 * 2. Education Tax on statutory income (gross - NIS - pension)
 * 3. NHT on gross
 * 4. PAYE on chargeable income (after threshold)
 */
export function calculatePayroll(input: PayrollInput): PayrollCalculation {
  const { basicSalary, overtime, bonus, commission, allowances, pensionContribution, otherDeductions, frequency } = input;

  // ── Step 0: Calculate gross pay ──
  const grossPay = basicSalary + overtime + bonus + commission + allowances;
  // Taxable gross excludes non-taxable allowances (travel, meals, laundry up to statutory limits)
  const nonTaxable = input.nonTaxableAllowances ?? 0;
  const taxableGross = Math.max(grossPay - nonTaxable, 0);

  // ── Step 1: NIS (on gross, capped at ceiling) ──
  const nisCeiling = getNisCeiling(frequency);
  const nisableIncome = Math.min(taxableGross, nisCeiling);

  // Check YTD ceiling for NIS (both employee and employer are capped at J$150K/yr each)
  let employeeNis: number;
  let employerNis: number;
  const periodNisEmployee = Math.round(nisableIncome * JAMAICA_TAX_RATES.NIS_EMPLOYEE_RATE * 100) / 100;
  const periodNisEmployer = Math.round(nisableIncome * JAMAICA_TAX_RATES.NIS_EMPLOYER_RATE * 100) / 100;

  if (input.ytdGross !== undefined && input.ytdNis !== undefined) {
    // Cap employee NIS based on YTD contributions
    const remainingEmployeeNisCap = Math.max(JAMAICA_TAX_RATES.NIS_MAX_ANNUAL_CONTRIBUTION - input.ytdNis, 0);
    employeeNis = Math.min(periodNisEmployee, remainingEmployeeNisCap);
    // Employer NIS mirrors employee cap (both hit ceiling at same time)
    employerNis = Math.min(periodNisEmployer, remainingEmployeeNisCap);
  } else {
    employeeNis = periodNisEmployee;
    employerNis = periodNisEmployer;
  }

  // ── Step 2: Education Tax (on statutory income: gross - NIS - pension) ──
  const statutoryIncome = Math.max(taxableGross - employeeNis - pensionContribution, 0);
  const employeeEdTax = Math.round(statutoryIncome * JAMAICA_TAX_RATES.EDUCATION_TAX_EMPLOYEE_RATE * 100) / 100;
  const employerEdTax = Math.round(statutoryIncome * JAMAICA_TAX_RATES.EDUCATION_TAX_EMPLOYER_RATE * 100) / 100;

  // ── Step 3: NHT (on gross) ──
  const employeeNht = Math.round(taxableGross * JAMAICA_TAX_RATES.NHT_EMPLOYEE_RATE * 100) / 100;
  const employerNht = Math.round(taxableGross * JAMAICA_TAX_RATES.NHT_EMPLOYER_RATE * 100) / 100;

  // ── Step 4: PAYE (on chargeable income after threshold) ──
  const threshold = getPayeThreshold(frequency);
  const bracket1Limit = getPayeBracket1(frequency);

  // Chargeable income = gross - NIS - pension - threshold
  const chargeableIncome = Math.max(taxableGross - employeeNis - pensionContribution - threshold, 0);

  let paye: number;
  if (chargeableIncome <= 0) {
    paye = 0;
  } else if (chargeableIncome <= bracket1Limit - threshold) {
    // All within 25% bracket
    paye = Math.round(chargeableIncome * JAMAICA_TAX_RATES.PAYE_RATE_1 * 100) / 100;
  } else {
    // Split between 25% and 30% brackets
    const amountAt25 = bracket1Limit - threshold;
    const amountAt30 = chargeableIncome - amountAt25;
    paye = Math.round((amountAt25 * JAMAICA_TAX_RATES.PAYE_RATE_1 + amountAt30 * JAMAICA_TAX_RATES.PAYE_RATE_2) * 100) / 100;
  }

  // ── Step 5: HEART/NTA (employer only) ──
  const heartNta = Math.round(taxableGross * JAMAICA_TAX_RATES.HEART_NTA_RATE * 100) / 100;

  // ── Totals ──
  const pension = pensionContribution;
  const totalEmployeeDeductions = employeeNis + employeeNht + employeeEdTax + paye + pension + otherDeductions;
  const totalEmployerContributions = employerNis + employerNht + employerEdTax + heartNta;
  const netPay = grossPay - totalEmployeeDeductions;

  return {
    grossPay,
    taxableGross,
    statutoryIncome,
    chargeableIncome,
    employee: {
      nis: employeeNis,
      nht: employeeNht,
      educationTax: employeeEdTax,
      paye,
      pension,
      otherDeductions,
      totalDeductions: totalEmployeeDeductions,
    },
    employer: {
      nis: employerNis,
      nht: employerNht,
      educationTax: employerEdTax,
      heartNta,
      total: totalEmployerContributions,
    },
    netPay,
  };
}

/**
 * Calculates payroll for multiple employees and returns aggregated totals.
 */
export function calculatePayrollBatch(inputs: PayrollInput[]): {
  calculations: PayrollCalculation[];
  totals: {
    totalGross: number;
    totalNet: number;
    totalPaye: number;
    totalEmployeeNis: number;
    totalEmployeeNht: number;
    totalEmployeeEdTax: number;
    totalEmployerNis: number;
    totalEmployerNht: number;
    totalEmployerEdTax: number;
    totalHeart: number;
    totalEmployerContributions: number;
    totalDeductions: number;
  };
} {
  const calculations = inputs.map(calculatePayroll);

  const totals = {
    totalGross: 0,
    totalNet: 0,
    totalPaye: 0,
    totalEmployeeNis: 0,
    totalEmployeeNht: 0,
    totalEmployeeEdTax: 0,
    totalEmployerNis: 0,
    totalEmployerNht: 0,
    totalEmployerEdTax: 0,
    totalHeart: 0,
    totalEmployerContributions: 0,
    totalDeductions: 0,
  };

  for (const calc of calculations) {
    totals.totalGross += calc.grossPay;
    totals.totalNet += calc.netPay;
    totals.totalPaye += calc.employee.paye;
    totals.totalEmployeeNis += calc.employee.nis;
    totals.totalEmployeeNht += calc.employee.nht;
    totals.totalEmployeeEdTax += calc.employee.educationTax;
    totals.totalEmployerNis += calc.employer.nis;
    totals.totalEmployerNht += calc.employer.nht;
    totals.totalEmployerEdTax += calc.employer.educationTax;
    totals.totalHeart += calc.employer.heartNta;
    totals.totalEmployerContributions += calc.employer.total;
    totals.totalDeductions += calc.employee.totalDeductions;
  }

  return { calculations, totals };
}
