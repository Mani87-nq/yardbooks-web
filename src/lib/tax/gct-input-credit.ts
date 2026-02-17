/**
 * GCT Input Tax Credit Restrictions (Jamaica Tax Administration)
 *
 * Jamaica restricts input tax credits for certain expense categories:
 * - Entertainment: 50% cap
 * - Motor vehicle expenses: 50% cap
 * - Restaurant meals: 50% cap
 * - Capital goods > JMD 100K: recovered over 24 months
 * - Mixed supply businesses: apportionment ratio applies
 *
 * Reference: GCT Act (Jamaica), TAJ guidelines
 */

// GCT Rate constants
export const GCT_RATES = {
  STANDARD: 0.15,
  TELECOM: 0.25,
  TOURISM: 0.10,
  ZERO_RATED: 0,
  EXEMPT: 0,
} as const;

export type GCTRateKey = keyof typeof GCT_RATES;

// Categories subject to 50% input credit restriction
export const RESTRICTED_CATEGORIES = new Set([
  'ENTERTAINMENT',
  'MOTOR_VEHICLE',
  'RESTAURANT',
  'MEALS',
  'VEHICLE_MAINTENANCE',
  'VEHICLE_FUEL',
]);

// Threshold for capital goods (in JMD)
export const CAPITAL_GOODS_THRESHOLD = 100_000;
export const CAPITAL_GOODS_RECOVERY_MONTHS = 24;

/**
 * Calculate the claimable GCT input credit for an expense.
 * Applies Jamaica's restriction rules.
 */
export function calculateClaimableCredit(params: {
  gctAmount: number;
  category: string;
  isCapitalGood: boolean;
  totalAmount: number;
  mixedSupplyRatio?: number; // 0-1, ratio of taxable to total supplies
}): InputCreditResult {
  const { gctAmount, category, isCapitalGood, totalAmount, mixedSupplyRatio } = params;

  if (gctAmount <= 0) {
    return { claimableAmount: 0, restrictionApplied: 'none', restrictionRate: 1 };
  }

  let claimable = gctAmount;
  let restrictionApplied: InputCreditResult['restrictionApplied'] = 'none';
  let restrictionRate = 1;

  // Step 1: Apply category-based restriction (50% cap)
  if (RESTRICTED_CATEGORIES.has(category.toUpperCase())) {
    claimable = gctAmount * 0.5;
    restrictionApplied = 'category_50_percent';
    restrictionRate = 0.5;
  }

  // Step 2: Capital goods > JMD 100K — must be recovered over 24 months
  if (isCapitalGood && totalAmount > CAPITAL_GOODS_THRESHOLD) {
    const monthlyRecovery = claimable / CAPITAL_GOODS_RECOVERY_MONTHS;
    return {
      claimableAmount: round2(monthlyRecovery),
      restrictionApplied: 'capital_goods_24_month',
      restrictionRate: 1 / CAPITAL_GOODS_RECOVERY_MONTHS,
      capitalGoodsSchedule: {
        totalCredit: round2(claimable),
        monthlyRecovery: round2(monthlyRecovery),
        remainingMonths: CAPITAL_GOODS_RECOVERY_MONTHS,
        totalRecoveredToDate: 0,
      },
    };
  }

  // Step 3: Mixed supply apportionment
  if (mixedSupplyRatio !== undefined && mixedSupplyRatio < 1) {
    claimable = claimable * mixedSupplyRatio;
    restrictionApplied = restrictionApplied === 'none' ? 'mixed_supply' : 'combined';
    restrictionRate = restrictionRate * mixedSupplyRatio;
  }

  return {
    claimableAmount: round2(claimable),
    restrictionApplied,
    restrictionRate: round2(restrictionRate),
  };
}

export interface InputCreditResult {
  claimableAmount: number;
  restrictionApplied: 'none' | 'category_50_percent' | 'capital_goods_24_month' | 'mixed_supply' | 'combined';
  restrictionRate: number;
  capitalGoodsSchedule?: {
    totalCredit: number;
    monthlyRecovery: number;
    remainingMonths: number;
    totalRecoveredToDate: number;
  };
}

/**
 * Calculate the mixed supply apportionment ratio.
 * Ratio = Taxable supplies / Total supplies (for the period)
 */
export function calculateMixedSupplyRatio(taxableSupplies: number, totalSupplies: number): number {
  if (totalSupplies <= 0) return 1;
  return Math.min(1, Math.max(0, round2(taxableSupplies / totalSupplies)));
}

/**
 * Generate a capital goods recovery schedule.
 */
export function generateCapitalGoodsSchedule(params: {
  purchaseDate: Date;
  totalGCT: number;
  alreadyRecoveredMonths: number;
}): CapitalGoodsMonth[] {
  const { purchaseDate, totalGCT, alreadyRecoveredMonths } = params;
  const monthlyAmount = round2(totalGCT / CAPITAL_GOODS_RECOVERY_MONTHS);
  const schedule: CapitalGoodsMonth[] = [];

  for (let i = 0; i < CAPITAL_GOODS_RECOVERY_MONTHS; i++) {
    const date = new Date(purchaseDate);
    date.setMonth(date.getMonth() + i);

    schedule.push({
      month: i + 1,
      date: date.toISOString().split('T')[0],
      amount: monthlyAmount,
      isRecovered: i < alreadyRecoveredMonths,
      cumulative: round2(monthlyAmount * (i + 1)),
    });
  }

  return schedule;
}

export interface CapitalGoodsMonth {
  month: number;
  date: string;
  amount: number;
  isRecovered: boolean;
  cumulative: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
