// YaadBooks Web - General Ledger Type Definitions

// ============================================
// JOURNAL ENTRIES
// ============================================

export interface JournalEntry {
  id: string;
  companyId?: string;
  entryNumber: string;
  journalNumber?: string;
  date: string;
  entryDate?: string;
  postDate?: string;
  description: string;
  reference?: string;
  sourceModule?: JournalSourceModule;
  sourceDocumentId?: string;
  sourceDocumentType?: string;
  lines: JournalEntryLine[];
  totalDebits: number;
  totalCredits: number;
  status: JournalStatus;
  isReversed?: boolean;
  reversalOf?: string;
  reversedBy?: string;
  createdBy?: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  postedBy?: string;
  postedAt?: string;
  updatedAt?: string;
  tags?: string[];
  notes?: string;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountName?: string;
  accountNumber?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  lineNumber: number;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  currency: 'JMD' | 'USD';
  exchangeRate: number;
  debitAmountJMD: number;
  creditAmountJMD: number;
  description?: string;
  departmentId?: string;
  projectId?: string;
  locationId?: string;
  taxCode?: string;
  taxAmount?: number;
  isReconciled: boolean;
  reconciledAt?: string;
  bankTransactionId?: string;
}

export type JournalStatus =
  | 'draft'
  | 'pending'
  | 'posted'
  | 'reversed'
  | 'void';

export type JournalSourceModule =
  | 'manual'
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'bill'
  | 'bill_payment'
  | 'payroll'
  | 'inventory'
  | 'stock_count'
  | 'fixed_asset'
  | 'depreciation'
  | 'bank_feed'
  | 'gct'
  | 'year_end'
  | 'opening'
  | 'system';

// ============================================
// ACCOUNTING PERIODS
// ============================================

export interface AccountingPeriod {
  id: string;
  companyId: string;
  periodNumber: number;
  fiscalYear: number;
  periodType: 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  lockedAt?: string;
  lockedBy?: string;
  lockedReason?: string;
  closedAt?: string;
  closedBy?: string;
  retainedEarningsPosted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PeriodStatus =
  | 'future'
  | 'open'
  | 'soft_locked'
  | 'locked'
  | 'closed';

// ============================================
// CHART OF ACCOUNTS (Extended)
// ============================================

export interface GLAccount {
  id: string;
  companyId?: string;
  code?: string;
  accountNumber: string;
  name: string;
  fullName?: string;
  type: GLAccountType;
  subType?: string | GLAccountSubType;
  normalBalance?: 'debit' | 'credit';
  parentCode?: string;
  parentAccountId?: string;
  level?: number;
  isHeader?: boolean;
  isActive: boolean;
  isSystemAccount?: boolean;
  isControlAccount?: boolean;
  isTaxAccount?: boolean;
  isBankAccount?: boolean;
  linkedBankAccountId?: string;
  gctClaimable?: boolean;
  defaultGctRate?: string;
  allowManualEntry?: boolean;
  requireDimensions?: boolean;
  currentBalance?: number;
  balance?: number;
  ytdDebits?: number;
  ytdCredits?: number;
  lastActivityDate?: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export type GLAccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'income'
  | 'expense';

export type GLAccountSubType =
  | 'current'
  | 'non_current'
  | 'cogs'
  | 'operating'
  | 'other';

// ============================================
// ACCOUNT BALANCES
// ============================================

export interface AccountBalance {
  id: string;
  companyId: string;
  accountCode: string;
  periodId: string;
  openingDebit: number;
  openingCredit: number;
  openingBalance: number;
  periodDebits: number;
  periodCredits: number;
  closingDebit: number;
  closingCredit: number;
  closingBalance: number;
  lastUpdated: string;
}

// ============================================
// TRIAL BALANCE
// ============================================

export interface TrialBalance {
  companyId: string;
  asOfDate: string;
  periodId?: string;
  accounts: TrialBalanceAccount[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  generatedAt: string;
}

export interface TrialBalanceAccount {
  accountCode: string;
  accountName: string;
  accountType: GLAccountType;
  openingDebit: number;
  openingCredit: number;
  periodDebits: number;
  periodCredits: number;
  closingDebit: number;
  closingCredit: number;
}

// ============================================
// FINANCIAL STATEMENTS
// ============================================

export interface IncomeStatement {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  revenue: IncomeStatementSection;
  costOfGoodsSold: IncomeStatementSection;
  grossProfit: number;
  operatingExpenses: IncomeStatementSection;
  operatingIncome: number;
  otherIncome: IncomeStatementSection;
  otherExpenses: IncomeStatementSection;
  profitBeforeTax: number;
  incomeTaxExpense: number;
  netProfit: number;
  generatedAt: string;
}

export interface IncomeStatementSection {
  items: IncomeStatementItem[];
  total: number;
}

export interface IncomeStatementItem {
  accountCode: string;
  accountName: string;
  amount: number;
  previousPeriodAmount?: number;
  variance?: number;
  variancePercent?: number;
}

export interface StatementOfFinancialPosition {
  companyId: string;
  asOfDate: string;
  comparativeDate?: string;
  currentAssets: BalanceSheetSection;
  nonCurrentAssets: BalanceSheetSection;
  totalAssets: number;
  currentLiabilities: BalanceSheetSection;
  nonCurrentLiabilities: BalanceSheetSection;
  totalLiabilities: number;
  equity: BalanceSheetSection;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  generatedAt: string;
}

export interface BalanceSheetSection {
  items: BalanceSheetItem[];
  total: number;
}

export interface BalanceSheetItem {
  accountCode: string;
  accountName: string;
  amount: number;
  comparativeAmount?: number;
}
