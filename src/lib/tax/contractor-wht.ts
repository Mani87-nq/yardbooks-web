/**
 * Jamaica Contractor Withholding Tax (WHT) Calculator
 *
 * Under Jamaica's Income Tax Act, businesses making payments to
 * unregistered contractors must withhold tax at source.
 *
 * Current rates:
 * - 3% on payments to unregistered individual contractors
 * - 3% on payments to unregistered corporate contractors
 * - 0% if contractor provides a valid TRN and TCC (Tax Compliance Certificate)
 *
 * The withheld tax must be remitted to TAJ by the 14th of the following month.
 *
 * Sources:
 * - Income Tax Act, Section 5(2)
 * - Tax Administration Jamaica (TAJ) WHT guidelines
 */

// ─── Constants ──────────────────────────────────────────────────

/** Standard contractor WHT rate (3%) */
export const CONTRACTOR_WHT_RATE = 0.03;

/** WHT rate for tax-compliant contractors (0%) */
export const COMPLIANT_WHT_RATE = 0;

/** Minimum payment amount before WHT applies (J$) */
export const WHT_MINIMUM_THRESHOLD = 0; // No minimum — applies to all payments

// ─── Types ──────────────────────────────────────────────────────

export interface WHTInput {
  /** Gross payment amount to contractor */
  grossAmount: number;
  /** Whether the contractor has a valid TCC (Tax Compliance Certificate) */
  hasTaxCompliance: boolean;
  /** Optional custom WHT rate override */
  customRate?: number;
  /** Type of WHT */
  taxType?: 'CONTRACTORS_LEVY' | 'DIVIDENDS' | 'INTEREST' | 'ROYALTIES' | 'MANAGEMENT_FEES';
}

export interface WHTResult {
  /** Gross payment amount */
  grossAmount: number;
  /** WHT rate applied */
  whtRate: number;
  /** WHT amount to withhold */
  whtAmount: number;
  /** Net amount to pay contractor */
  netAmount: number;
  /** Whether WHT was applied */
  whtApplied: boolean;
  /** Reason for WHT application or exemption */
  reason: string;
}

// ─── Calculator ──────────────────────────────────────────────────

/**
 * Calculate withholding tax on a contractor payment.
 */
export function calculateContractorWHT(input: WHTInput): WHTResult {
  const { grossAmount, hasTaxCompliance, customRate, taxType } = input;

  // If contractor has valid TCC, no WHT applies
  if (hasTaxCompliance) {
    return {
      grossAmount,
      whtRate: 0,
      whtAmount: 0,
      netAmount: grossAmount,
      whtApplied: false,
      reason: 'Contractor has valid Tax Compliance Certificate (TCC)',
    };
  }

  // Determine rate based on tax type
  let rate: number;
  if (customRate !== undefined) {
    rate = customRate;
  } else {
    switch (taxType) {
      case 'DIVIDENDS':
        rate = 0.15; // 15% on dividends to non-residents
        break;
      case 'INTEREST':
        rate = 0.25; // 25% on interest payments
        break;
      case 'ROYALTIES':
        rate = 0.25; // 25% on royalties
        break;
      case 'MANAGEMENT_FEES':
        rate = 0.25; // 25% on management fees
        break;
      case 'CONTRACTORS_LEVY':
      default:
        rate = CONTRACTOR_WHT_RATE; // 3% standard contractor levy
        break;
    }
  }

  const whtAmount = Math.round(grossAmount * rate * 100) / 100;
  const netAmount = Math.round((grossAmount - whtAmount) * 100) / 100;

  return {
    grossAmount,
    whtRate: rate,
    whtAmount,
    netAmount,
    whtApplied: true,
    reason: `${(rate * 100).toFixed(1)}% withholding tax applied (no TCC on file)`,
  };
}

/**
 * Calculate WHT for a batch of contractor payments.
 */
export function calculateBatchWHT(payments: WHTInput[]): {
  results: WHTResult[];
  totalGross: number;
  totalWHT: number;
  totalNet: number;
} {
  const results = payments.map(calculateContractorWHT);

  const totalGross = results.reduce((sum, r) => sum + r.grossAmount, 0);
  const totalWHT = results.reduce((sum, r) => sum + r.whtAmount, 0);
  const totalNet = results.reduce((sum, r) => sum + r.netAmount, 0);

  return {
    results,
    totalGross: Math.round(totalGross * 100) / 100,
    totalWHT: Math.round(totalWHT * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
  };
}
