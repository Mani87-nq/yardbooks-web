// YaadBooks Web - Core Type Definitions
//
// NOTE: All date fields are typed as `string` (ISO 8601 format) because
// API responses serialize dates via NextResponse.json(). The Zustand store
// and React components always receive ISO strings, never Date objects.
// Use `new Date(field)` when you need Date arithmetic in a component.

// ============================================
// USER & AUTHENTICATION
// ============================================
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  pin?: string;
  role?: 'admin' | 'user' | 'staff';
  biometricEnabled?: boolean;
  activeCompanyId?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// COMPANY (Multi-Company Support)
// ============================================
export type SubscriptionPlanType = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE' | 'SOLO' | 'TEAM' | 'PRO';
export type SubscriptionStatusType = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INACTIVE';

export interface Company {
  id: string;
  ownerId?: string;
  businessName: string;
  tradingName?: string;
  businessType?: BusinessType;
  trnNumber?: string;
  gctNumber?: string;
  gctRegistered?: boolean;
  phone?: string;
  email?: string;
  website?: string;
  address?: string | Address;
  parish?: string;
  industry?: string;
  currency?: 'JMD' | 'USD';
  fiscalYearEnd?: number;
  logoUri?: string;
  invoiceSettings?: InvoiceSettings;
  taxSettings?: TaxSettings;
  receiptSettings?: ReceiptSettings;
  // Subscription & billing
  subscriptionPlan?: SubscriptionPlanType;
  subscriptionStatus?: SubscriptionStatusType;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  onboardingCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSettings {
  prefix: string;
  nextNumber: number;
  termsAndConditions?: string;
  notes?: string;
  showLogo: boolean;
  primaryColor: string;
  accentColor: string;
  template: 'classic' | 'modern' | 'minimal' | 'professional';
  footer?: string;
}

// ============================================
// TAX & RECEIPT SETTINGS
// ============================================

export interface TaxSettings {
  enabled: boolean;
  taxName: string; // "GCT", "VAT", "Sales Tax", etc.
  defaultRate: number; // Decimal format (e.g., 0.15 = 15%)
  rates: TaxRate[];
  showTaxOnReceipts: boolean;
  showTaxBreakdown: boolean;
  taxIncludedInPrice: boolean;
}

export interface TaxRate {
  id: string;
  name: string; // "Standard", "Reduced", "Zero-rated", etc.
  rate: number; // Decimal format (e.g., 0.15 = 15%)
  description?: string;
  isDefault?: boolean;
}

export interface ReceiptSettings {
  showLogo: boolean;
  showTaxBreakdown: boolean;
  headerText?: string;
  footerText?: string;
  fontSize?: 'small' | 'medium' | 'large';
}

export type BusinessType =
  | 'sole_proprietor'
  | 'partnership'
  | 'limited_company'
  | 'ngo'
  | 'other';

export interface Address {
  street: string;
  city: string;
  parish: JamaicanParish;
  country: string;
  postalCode?: string;
}

export type JamaicanParish =
  | 'Kingston'
  | 'St. Andrew'
  | 'St. Thomas'
  | 'Portland'
  | 'St. Mary'
  | 'St. Ann'
  | 'Trelawny'
  | 'St. James'
  | 'Hanover'
  | 'Westmoreland'
  | 'St. Elizabeth'
  | 'Manchester'
  | 'Clarendon'
  | 'St. Catherine';

// ============================================
// CUSTOMER & VENDOR
// ============================================
export interface Customer {
  id: string;
  companyId: string; // Required for multi-company support
  type: 'customer' | 'vendor' | 'both';
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: Address;
  trnNumber?: string;
  notes?: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PRODUCT & INVENTORY
// ============================================
export interface Product {
  id: string;
  companyId: string; // Required for multi-company support
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  reorderLevel: number;
  unit: ProductUnit;
  baseUOMId?: string;
  purchaseUOMId?: string;
  salesUOMId?: string;
  purchaseConversionFactor?: number;
  salesConversionFactor?: number;
  baseUnitPrice?: number;
  baseCostPrice?: number;
  allowedSalesUOMIds?: string[];
  taxable: boolean;
  gctRate: GCTRate;
  imageUri?: string;
  barcode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductUnit =
  | 'each'
  | 'box'
  | 'case'
  | 'dozen'
  | 'kg'
  | 'lb'
  | 'litre'
  | 'gallon'
  | 'metre'
  | 'foot'
  | 'hour'
  | 'day';

export type GCTRate =
  | 'standard'      // 15%
  | 'telecom'       // 25%
  | 'tourism'       // 10%
  | 'zero_rated'    // 0%
  | 'exempt';       // Not applicable

// ============================================
// INVOICE & QUOTATION
// ============================================
export interface Invoice {
  id: string;
  companyId: string; // Required for multi-company support
  invoiceNumber: string;
  customerId: string;
  customer?: Customer;
  items: InvoiceItem[];
  subtotal: number;
  gctAmount: number;
  discount: number;
  discountType: 'fixed' | 'percentage';
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  dueDate: string;
  issueDate: string;
  notes?: string;
  terms?: string;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
  customerPOId?: string;
  customerPONumber?: string;
}

export interface InvoiceItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gctRate: GCTRate;
  gctAmount: number;
  total: number;
  uomId?: string;
  uomShortCode?: string;
  baseQuantity?: number;
  conversionFactor?: number;
}

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface QuotationItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
}

export interface Quotation {
  id: string;
  companyId: string; // Required for multi-company support
  quotationNumber: string;
  customerId: string;
  customerName?: string;
  customer?: Customer;
  items: QuotationItem[];
  subtotal: number;
  taxAmount: number;
  gctAmount?: number;
  discount?: number;
  discountType?: 'fixed' | 'percentage';
  total: number;
  status: QuotationStatus;
  validUntil: string;
  issueDate?: string;
  sentAt?: string;
  acceptedAt?: string;
  notes?: string;
  terms?: string;
  convertedToInvoice?: boolean;
  convertedToInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

// ============================================
// EXPENSES
// ============================================
export interface Expense {
  id: string;
  companyId: string; // Required for multi-company support
  vendorId?: string;
  vendor?: Customer;
  category: ExpenseCategory;
  description: string;
  amount: number;
  gctAmount: number;
  gctClaimable: boolean;
  date: string;
  paymentMethod: PaymentMethod;
  receiptUri?: string;
  reference?: string;
  notes?: string;
  isRecurring: boolean;
  recurringSchedule?: RecurringSchedule;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | 'advertising'
  | 'bank_fees'
  | 'contractor'
  | 'equipment'
  | 'insurance'
  | 'inventory'
  | 'meals'
  | 'office_supplies'
  | 'professional_services'
  | 'rent'
  | 'repairs'
  | 'salaries'
  | 'software'
  | 'taxes'
  | 'telephone'
  | 'travel'
  | 'utilities'
  | 'vehicle'
  | 'other';

export type PaymentMethod =
  | 'cash'
  | 'cheque'
  | 'bank_transfer'
  | 'credit_card'
  | 'debit_card'
  | 'mobile_money';

export interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  nextDueDate: string;
}

// ============================================
// PAYMENTS
// ============================================
export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  date: string;
  createdAt: string;
}

// ============================================
// PAYROLL & EMPLOYEES
// ============================================
export interface Employee {
  id: string;
  companyId: string; // Required for multi-company support
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: Address;
  trnNumber: string;
  nisNumber: string;
  dateOfBirth: string;
  hireDate: string;
  terminationDate?: string;
  department?: string;
  position: string;
  employmentType: 'full_time' | 'part_time' | 'contract';
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly';
  baseSalary: number;
  bankName?: string;
  bankAccountNumber?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  companyId: string; // Required for multi-company support
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: 'draft' | 'approved' | 'paid';
  entries: PayrollEntry[];
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerContributions: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollEntry {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employee?: Employee;
  basicSalary: number;
  overtime: number;
  bonus: number;
  commission: number;
  allowances: number;
  grossPay: number;
  paye: number;
  nis: number;
  nht: number;
  educationTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  employerNis: number;
  employerNht: number;
  employerEducationTax: number;
  heartContribution: number;
  totalEmployerContributions: number;
}

// ============================================
// REPORTS
// ============================================
export interface ProfitLossReport {
  periodStart: string;
  periodEnd: string;
  income: {
    sales: number;
    otherIncome: number;
    totalIncome: number;
  };
  expenses: {
    byCategory: Record<ExpenseCategory, number>;
    totalExpenses: number;
  };
  grossProfit: number;
  netProfit: number;
}

export interface BalanceSheet {
  asOfDate: string;
  assets: {
    cash: number;
    accountsReceivable: number;
    inventory: number;
    totalAssets: number;
  };
  liabilities: {
    accountsPayable: number;
    taxesPayable: number;
    totalLiabilities: number;
  };
  equity: number;
}

export interface GCTReport {
  periodStart: string;
  periodEnd: string;
  outputGCT: number;
  inputGCT: number;
  netGCT: number;
  salesByRate: Record<GCTRate, { sales: number; gct: number }>;
}

export interface CashFlowReport {
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  inflows: {
    customerPayments: number;
    otherIncome: number;
    total: number;
  };
  outflows: {
    vendorPayments: number;
    expenses: number;
    payroll: number;
    taxes: number;
    total: number;
  };
  netCashFlow: number;
}

// ============================================
// CHART OF ACCOUNTS
// ============================================
export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  balance: number;
  isSystem: boolean;
  createdAt: string;
}

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'income'
  | 'expense';

// ============================================
// AI ASSISTANT
// ============================================
export interface AIQuery {
  id: string;
  query: string;
  language: 'english' | 'patois';
  normalizedQuery: string;
  intent: AIIntent;
  entities: Record<string, unknown>;
  response: string;
  createdAt: string;
}

export type AIIntent =
  | 'create_invoice'
  | 'create_expense'
  | 'check_balance'
  | 'view_report'
  | 'add_customer'
  | 'add_product'
  | 'check_inventory'
  | 'calculate_tax'
  | 'general_query';

// ============================================
// APP STATE
// ============================================
export interface DashboardWidgets {
  cashFlow: boolean;
  profitLoss: boolean;
  invoices: boolean;
  expenses: boolean;
  inventory: boolean;
  activity: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'english' | 'patois' | 'bilingual';
  currency: string; // ISO 4217 — 'JMD' | 'USD' | 'GBP' | 'CAD' | 'EUR' | etc.
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  invoicePrefix: string;
  quotationPrefix: string;
  defaultPaymentTerms: number;
  defaultGCTRate: GCTRate;
  enableNotifications: boolean;
  autoBackup: boolean;
  dashboardWidgets: DashboardWidgets;
}
