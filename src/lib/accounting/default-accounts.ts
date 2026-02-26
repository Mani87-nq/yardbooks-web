/**
 * Default Chart of Accounts for Jamaica-based businesses
 * Based on standard accounting practices adapted for Jamaican tax compliance
 *
 * Account numbering convention:
 * 1000-1999: Assets
 * 2000-2999: Liabilities
 * 3000-3999: Equity
 * 4000-4999: Income/Revenue
 * 5000-5999: Cost of Goods Sold
 * 6000-6999: Operating Expenses
 * 7000-7999: Other Income/Expenses
 */

export interface DefaultAccount {
  accountNumber: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  subType?: 'CURRENT' | 'NON_CURRENT' | 'COGS' | 'OPERATING' | 'OTHER';
  normalBalance: 'debit' | 'credit';
  isSystemAccount: boolean;
  isControlAccount: boolean;
  isTaxAccount: boolean;
  isBankAccount: boolean;
  description?: string;
}

/**
 * System account codes used by the accounting engine for auto-posting.
 * These MUST exist for the engine to work.
 */
export const SYSTEM_ACCOUNTS = {
  // Assets
  CASH: '1000',
  PETTY_CASH: '1010',
  BANK_ACCOUNT: '1020',
  ACCOUNTS_RECEIVABLE: '1100',
  INVENTORY: '1200',
  PREPAID_EXPENSES: '1300',
  FIXED_ASSETS: '1500',
  ACCUMULATED_DEPRECIATION: '1510',

  // Liabilities
  ACCOUNTS_PAYABLE: '2000',
  GCT_PAYABLE: '2100',
  GCT_INPUT_TAX: '2110',
  PAYE_PAYABLE: '2200',
  NIS_PAYABLE: '2210',
  NHT_PAYABLE: '2220',
  EDUCATION_TAX_PAYABLE: '2230',
  HEART_NTA_PAYABLE: '2240',
  WHT_PAYABLE: '2250',
  SALARIES_PAYABLE: '2300',
  EMPLOYER_NIS_PAYABLE: '2310',
  EMPLOYER_NHT_PAYABLE: '2320',
  EMPLOYER_EDUCATION_TAX_PAYABLE: '2330',
  UNEARNED_REVENUE: '2400',

  // Equity
  OWNERS_EQUITY: '3000',
  RETAINED_EARNINGS: '3100',
  CURRENT_YEAR_EARNINGS: '3200',

  // Revenue
  SALES_REVENUE: '4000',
  SERVICE_REVENUE: '4100',
  OTHER_INCOME: '4500',
  DISCOUNT_GIVEN: '4900',

  // Cost of Goods Sold
  COST_OF_GOODS_SOLD: '5000',

  // Operating Expenses
  ADVERTISING_EXPENSE: '6000',
  BANK_FEES_EXPENSE: '6010',
  CONTRACTOR_EXPENSE: '6020',
  DEPRECIATION_EXPENSE: '6030',
  EQUIPMENT_EXPENSE: '6040',
  INSURANCE_EXPENSE: '6050',
  MEALS_EXPENSE: '6060',
  OFFICE_SUPPLIES_EXPENSE: '6070',
  PROFESSIONAL_SERVICES_EXPENSE: '6080',
  RENT_EXPENSE: '6090',
  REPAIRS_EXPENSE: '6100',
  SALARY_EXPENSE: '6110',
  EMPLOYER_PAYROLL_TAX_EXPENSE: '6120',
  SOFTWARE_EXPENSE: '6130',
  TAXES_EXPENSE: '6140',
  TELEPHONE_EXPENSE: '6150',
  TRAVEL_EXPENSE: '6160',
  UTILITIES_EXPENSE: '6170',
  VEHICLE_EXPENSE: '6180',
  MISCELLANEOUS_EXPENSE: '6190',

  // Other
  INTEREST_INCOME: '7000',
  INTEREST_EXPENSE: '7100',
  GAIN_ON_DISPOSAL: '7200',
  LOSS_ON_DISPOSAL: '7300',
} as const;

/**
 * Maps expense categories from the Expense model to GL account codes
 */
export const EXPENSE_CATEGORY_TO_ACCOUNT: Record<string, string> = {
  ADVERTISING: SYSTEM_ACCOUNTS.ADVERTISING_EXPENSE,
  BANK_FEES: SYSTEM_ACCOUNTS.BANK_FEES_EXPENSE,
  CONTRACTOR: SYSTEM_ACCOUNTS.CONTRACTOR_EXPENSE,
  EQUIPMENT: SYSTEM_ACCOUNTS.EQUIPMENT_EXPENSE,
  INSURANCE: SYSTEM_ACCOUNTS.INSURANCE_EXPENSE,
  INVENTORY: SYSTEM_ACCOUNTS.COST_OF_GOODS_SOLD,
  MEALS: SYSTEM_ACCOUNTS.MEALS_EXPENSE,
  OFFICE_SUPPLIES: SYSTEM_ACCOUNTS.OFFICE_SUPPLIES_EXPENSE,
  PROFESSIONAL_SERVICES: SYSTEM_ACCOUNTS.PROFESSIONAL_SERVICES_EXPENSE,
  RENT: SYSTEM_ACCOUNTS.RENT_EXPENSE,
  REPAIRS: SYSTEM_ACCOUNTS.REPAIRS_EXPENSE,
  SALARIES: SYSTEM_ACCOUNTS.SALARY_EXPENSE,
  SOFTWARE: SYSTEM_ACCOUNTS.SOFTWARE_EXPENSE,
  TAXES: SYSTEM_ACCOUNTS.TAXES_EXPENSE,
  TELEPHONE: SYSTEM_ACCOUNTS.TELEPHONE_EXPENSE,
  TRAVEL: SYSTEM_ACCOUNTS.TRAVEL_EXPENSE,
  UTILITIES: SYSTEM_ACCOUNTS.UTILITIES_EXPENSE,
  VEHICLE: SYSTEM_ACCOUNTS.VEHICLE_EXPENSE,
  OTHER: SYSTEM_ACCOUNTS.MISCELLANEOUS_EXPENSE,
};

/**
 * Full default chart of accounts to seed for new companies
 */
export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  // ── ASSETS ──
  { accountNumber: '1000', name: 'Cash on Hand', type: 'ASSET', subType: 'CURRENT', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '1010', name: 'Petty Cash', type: 'ASSET', subType: 'CURRENT', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '1020', name: 'Bank Account', type: 'ASSET', subType: 'CURRENT', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: true },
  { accountNumber: '1100', name: 'Accounts Receivable', type: 'ASSET', subType: 'CURRENT', normalBalance: 'debit', isSystemAccount: true, isControlAccount: true, isTaxAccount: false, isBankAccount: false, description: 'Money owed by customers' },
  { accountNumber: '1200', name: 'Inventory', type: 'ASSET', subType: 'CURRENT', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '1300', name: 'Prepaid Expenses', type: 'ASSET', subType: 'CURRENT', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '1500', name: 'Fixed Assets', type: 'ASSET', subType: 'NON_CURRENT', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '1510', name: 'Accumulated Depreciation', type: 'ASSET', subType: 'NON_CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },

  // ── LIABILITIES ──
  { accountNumber: '2000', name: 'Accounts Payable', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: true, isTaxAccount: false, isBankAccount: false, description: 'Money owed to vendors' },
  { accountNumber: '2100', name: 'GCT Payable (Output Tax)', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false, description: 'GCT collected on sales' },
  { accountNumber: '2110', name: 'GCT Input Tax Credit', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false, description: 'GCT paid on purchases (claimable)' },
  { accountNumber: '2200', name: 'PAYE Payable', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false },
  { accountNumber: '2210', name: 'NIS Payable (Employee)', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false },
  { accountNumber: '2220', name: 'NHT Payable (Employee)', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false },
  { accountNumber: '2230', name: 'Education Tax Payable (Employee)', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false },
  { accountNumber: '2240', name: 'HEART/NTA Payable', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false },
  { accountNumber: '2250', name: 'Withholding Tax Payable', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false, description: 'WHT deducted from contractor payments' },
  { accountNumber: '2300', name: 'Salaries & Wages Payable', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '2310', name: 'NIS Payable (Employer)', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false },
  { accountNumber: '2320', name: 'NHT Payable (Employer)', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false },
  { accountNumber: '2330', name: 'Education Tax Payable (Employer)', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: true, isBankAccount: false },
  { accountNumber: '2400', name: 'Unearned Revenue', type: 'LIABILITY', subType: 'CURRENT', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },

  // ── EQUITY ──
  { accountNumber: '3000', name: "Owner's Equity / Capital", type: 'EQUITY', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '3100', name: 'Retained Earnings', type: 'EQUITY', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '3200', name: 'Current Year Earnings', type: 'EQUITY', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },

  // ── REVENUE ──
  { accountNumber: '4000', name: 'Sales Revenue', type: 'INCOME', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '4100', name: 'Service Revenue', type: 'INCOME', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '4500', name: 'Other Income', type: 'INCOME', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '4900', name: 'Discounts Given', type: 'INCOME', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },

  // ── COST OF GOODS SOLD ──
  { accountNumber: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', subType: 'COGS', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },

  // ── OPERATING EXPENSES ──
  { accountNumber: '6000', name: 'Advertising & Marketing', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6010', name: 'Bank Fees & Charges', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6020', name: 'Contractor Expense', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6030', name: 'Depreciation Expense', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6040', name: 'Equipment Expense', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6050', name: 'Insurance', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6060', name: 'Meals & Entertainment', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6070', name: 'Office Supplies', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6080', name: 'Professional Services', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6090', name: 'Rent', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6100', name: 'Repairs & Maintenance', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6110', name: 'Salaries & Wages', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6120', name: 'Employer Payroll Taxes', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false, description: 'Employer NIS, NHT, Ed Tax, HEART/NTA' },
  { accountNumber: '6130', name: 'Software & Technology', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6140', name: 'Taxes & Licences', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6150', name: 'Telephone & Internet', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6160', name: 'Travel', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6170', name: 'Utilities', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6180', name: 'Vehicle Expense', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '6190', name: 'Miscellaneous Expense', type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },

  // ── OTHER INCOME / EXPENSES ──
  { accountNumber: '7000', name: 'Interest Income', type: 'INCOME', subType: 'OTHER', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '7100', name: 'Interest Expense', type: 'EXPENSE', subType: 'OTHER', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '7200', name: 'Gain on Asset Disposal', type: 'INCOME', subType: 'OTHER', normalBalance: 'credit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
  { accountNumber: '7300', name: 'Loss on Asset Disposal', type: 'EXPENSE', subType: 'OTHER', normalBalance: 'debit', isSystemAccount: true, isControlAccount: false, isTaxAccount: false, isBankAccount: false },
];
