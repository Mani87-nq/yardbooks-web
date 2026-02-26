/**
 * Jamaica Capital Allowance Classes
 *
 * Under Jamaica's Income Tax Act, businesses can claim capital allowances
 * (tax depreciation) on qualifying capital expenditure.
 *
 * Two types of allowances:
 * 1. Initial Allowance — claimed in the year of acquisition
 * 2. Annual Allowance — claimed each subsequent year on the written-down value
 *
 * Sources:
 * - Income Tax Act (Jamaica), Fourth Schedule
 * - Tax Administration Jamaica (TAJ) guidelines
 * - PWC Jamaica Tax Summary 2026
 */

export interface JamaicaAssetClass {
  /** Class code used in system */
  code: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Initial allowance rate (year of purchase) */
  initialAllowanceRate: number;
  /** Annual allowance rate (reducing balance) */
  annualAllowanceRate: number;
  /** Maximum cost eligible for allowances (null = no cap) */
  maxCost: number | null;
  /** Typical useful life in years (for book depreciation) */
  typicalUsefulLife: number;
  /** Examples of qualifying items */
  examples: string[];
}

/**
 * Jamaica capital allowance classes per Income Tax Act Fourth Schedule.
 *
 * Rates are applied to the written-down value (reducing balance method).
 * Initial allowance is in addition to the annual allowance in year 1.
 */
export const JAMAICA_ASSET_CLASSES: JamaicaAssetClass[] = [
  {
    code: 'BUILDINGS',
    name: 'Buildings (Industrial)',
    description: 'Industrial buildings and structures used for manufacturing, processing, or storage',
    initialAllowanceRate: 0,
    annualAllowanceRate: 0.025, // 2.5% per annum
    maxCost: null,
    typicalUsefulLife: 40,
    examples: ['Factory buildings', 'Warehouses', 'Processing plants'],
  },
  {
    code: 'PLANT_MACHINERY',
    name: 'Plant & Machinery',
    description: 'Machinery and equipment used in business operations',
    initialAllowanceRate: 0.20, // 20% initial
    annualAllowanceRate: 0.10, // 10% annual
    maxCost: null,
    typicalUsefulLife: 10,
    examples: ['Manufacturing equipment', 'Generators', 'Air conditioning systems', 'Security systems'],
  },
  {
    code: 'MOTOR_VEHICLES',
    name: 'Motor Vehicles',
    description: 'Motor vehicles used in business. Cost capped at J$5,000,000 for allowance purposes.',
    initialAllowanceRate: 0.20, // 20% initial
    annualAllowanceRate: 0.20, // 20% annual
    maxCost: 5_000_000, // J$5M cap
    typicalUsefulLife: 5,
    examples: ['Cars', 'Trucks', 'Vans', 'Motorcycles'],
  },
  {
    code: 'COMPUTERS',
    name: 'Computers & IT Equipment',
    description: 'Computer hardware, servers, and IT infrastructure',
    initialAllowanceRate: 0.20, // 20% initial
    annualAllowanceRate: 0.25, // 25% annual
    maxCost: null,
    typicalUsefulLife: 4,
    examples: ['Computers', 'Servers', 'Printers', 'Networking equipment', 'POS terminals'],
  },
  {
    code: 'FURNITURE_FIXTURES',
    name: 'Furniture & Fixtures',
    description: 'Office furniture, fixtures, and fittings',
    initialAllowanceRate: 0.20, // 20% initial
    annualAllowanceRate: 0.10, // 10% annual
    maxCost: null,
    typicalUsefulLife: 10,
    examples: ['Office furniture', 'Display units', 'Shelving', 'Signage'],
  },
  {
    code: 'SOFTWARE',
    name: 'Software & Licenses',
    description: 'Purchased software licenses and custom software development',
    initialAllowanceRate: 0.20, // 20% initial
    annualAllowanceRate: 0.25, // 25% annual
    maxCost: null,
    typicalUsefulLife: 4,
    examples: ['ERP software', 'Accounting software', 'Custom applications'],
  },
  {
    code: 'LEASEHOLD_IMPROVEMENTS',
    name: 'Leasehold Improvements',
    description: 'Improvements to leased property, amortized over lease term or useful life (whichever is shorter)',
    initialAllowanceRate: 0,
    annualAllowanceRate: 0.10, // 10% annual
    maxCost: null,
    typicalUsefulLife: 10,
    examples: ['Office renovations', 'Store fit-outs', 'Tenant improvements'],
  },
];

/**
 * Look up a Jamaica asset class by code.
 */
export function getAssetClass(code: string): JamaicaAssetClass | undefined {
  return JAMAICA_ASSET_CLASSES.find((c) => c.code === code);
}

/**
 * Get all asset class codes and names (for dropdowns).
 */
export function getAssetClassOptions(): Array<{ code: string; name: string }> {
  return JAMAICA_ASSET_CLASSES.map((c) => ({ code: c.code, name: c.name }));
}

/**
 * Calculate first-year capital allowance for an asset.
 *
 * @param cost - The asset's acquisition cost
 * @param classCode - The Jamaica asset class code
 * @returns Object with initial allowance, annual allowance, and total year-1 claim
 */
export function calculateFirstYearAllowance(cost: number, classCode: string): {
  initialAllowance: number;
  annualAllowance: number;
  totalYear1: number;
  allowableCost: number;
} {
  const assetClass = getAssetClass(classCode);
  if (!assetClass) {
    return { initialAllowance: 0, annualAllowance: 0, totalYear1: 0, allowableCost: cost };
  }

  // Apply cost cap if applicable (e.g., J$5M for motor vehicles)
  const allowableCost = assetClass.maxCost ? Math.min(cost, assetClass.maxCost) : cost;

  // Initial allowance = rate * allowable cost
  const initialAllowance = Math.round(allowableCost * assetClass.initialAllowanceRate * 100) / 100;

  // Annual allowance = rate * (allowable cost - initial allowance)
  const writtenDownAfterInitial = allowableCost - initialAllowance;
  const annualAllowance = Math.round(writtenDownAfterInitial * assetClass.annualAllowanceRate * 100) / 100;

  return {
    initialAllowance,
    annualAllowance,
    totalYear1: Math.round((initialAllowance + annualAllowance) * 100) / 100,
    allowableCost,
  };
}
