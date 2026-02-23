// YaadBooks Web - Fixed Asset Register Type Definitions
// Supports dual tracking: Book Depreciation (IFRS) + Tax Capital Allowances (Jamaica)

// ============================================
// FIXED ASSET CORE
// ============================================

export interface FixedAsset {
  id: string;
  companyId?: string;
  assetTag?: string;
  // Simplified aliases for basic form usage
  name?: string;
  assetNumber?: string;
  category?: string;
  purchaseDate?: Date;
  purchaseCost?: number;
  salvageValue?: number;
  usefulLife?: number;
  depreciationMethod?: string;
  location?: string;
  vendor?: string;
  // Full IFRS/Tax tracking properties
  description: string;
  serialNumber?: string;
  barcode?: string;
  categoryId?: string;
  categoryCode?: string;
  categoryName?: string;
  locationId?: string;
  locationName?: string;
  departmentId?: string;
  departmentName?: string;
  assignedTo?: string;
  assignedToName?: string;
  acquisitionDate?: Date;
  acquisitionMethod?: AssetAcquisitionMethod;
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: Date;
  purchaseOrderNumber?: string;
  acquisitionCost?: number;
  currency?: 'JMD' | 'USD';
  exchangeRate?: number;
  acquisitionCostJMD?: number;
  installationCost?: number;
  freightCost?: number;
  customsDuty?: number;
  otherCapitalizedCosts?: number;
  totalCapitalizedCost?: number;
  bookDepreciationMethod?: DepreciationMethod;
  bookUsefulLifeMonths?: number;
  bookResidualValue?: number;
  bookDepreciationStartDate?: Date;
  bookAccumulatedDepreciation?: number;
  bookNetBookValue?: number;
  taxCapitalAllowanceClass?: string;
  taxInitialAllowanceRate?: number;
  taxAnnualAllowanceRate?: number;
  taxInitialAllowanceClaimed?: number;
  taxAccumulatedAllowances?: number;
  taxWrittenDownValue?: number;
  taxCostCap?: number;
  taxEligibleCost?: number;
  status: AssetStatus;
  isFullyDepreciated?: boolean;
  isFullyAllowed?: boolean;
  disposalId?: string;
  disposalDate?: Date;
  disposalMethod?: AssetDisposalMethod;
  disposalProceeds?: number;
  insuredValue?: number;
  insurancePolicyNumber?: string;
  insuranceExpiry?: Date;
  warrantyExpiry?: Date;
  warrantyProvider?: string;
  lastPhysicalVerificationDate?: Date;
  physicalVerificationNotes?: string;
  hasInvoice?: boolean;
  hasContract?: boolean;
  hasCustomsEntry?: boolean;
  hasInsurance?: boolean;
  hasWarranty?: boolean;
  attachmentIds?: string[];
  assetGLAccountCode?: string;
  accumulatedDepGLAccountCode?: string;
  depreciationExpenseGLAccountCode?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
}

export type AssetStatus =
  | 'active'
  | 'idle'
  | 'under_maintenance'
  | 'disposed'
  | 'lost'
  | 'transferred';

export type AssetAcquisitionMethod =
  | 'purchase'
  | 'lease_finance'
  | 'donation'
  | 'construction'
  | 'transfer'
  | 'opening_balance';

export type DepreciationMethod =
  | 'straight_line'
  | 'reducing_balance'
  | 'units_of_production'
  | 'none';

export type AssetDisposalMethod =
  | 'sale'
  | 'trade_in'
  | 'scrap'
  | 'donation'
  | 'theft'
  | 'write_off'
  | 'transfer';

// ============================================
// ASSET CATEGORIES
// ============================================

export interface AssetCategory {
  id: string;
  companyId: string;
  countryCode: string;
  code: string;
  name: string;
  description?: string;
  assetGLAccountCode: string;
  accumulatedDepGLAccountCode: string;
  depreciationExpenseGLAccountCode: string;
  gainOnDisposalGLAccountCode: string;
  lossOnDisposalGLAccountCode: string;
  defaultBookMethod: DepreciationMethod;
  defaultBookUsefulLifeMonths: number;
  defaultBookResidualValuePercent: number;
  taxCapitalAllowanceClass: string;
  taxInitialAllowanceRate: number;
  taxAnnualAllowanceRate: number;
  taxAllowanceYears: number;
  hasCostCap: boolean;
  costCapAmount?: number;
  costCapCurrency?: 'USD' | 'JMD';
  isActive: boolean;
  isSystemCategory: boolean;
  requiresSerialNumber: boolean;
  requiresInsurance: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DEPRECIATION ENTRIES
// ============================================

export interface FixedAssetDepreciationEntry {
  id: string;
  companyId: string;
  assetId: string;
  fiscalYear: number;
  periodNumber: number;
  periodStartDate: Date;
  periodEndDate: Date;
  bookDepreciationAmount: number;
  bookOpeningNBV: number;
  bookClosingNBV: number;
  taxAllowanceType: 'initial' | 'annual' | 'none';
  taxAllowanceAmount: number;
  taxOpeningWDV: number;
  taxClosingWDV: number;
  status: DepreciationEntryStatus;
  isPosted: boolean;
  journalEntryId?: string;
  createdAt: Date;
  postedAt?: Date;
  postedBy?: string;
}

export type DepreciationEntryStatus =
  | 'draft'
  | 'posted'
  | 'reversed';

// ============================================
// DEPRECIATION RUN
// ============================================

export interface DepreciationRun {
  id: string;
  companyId: string;
  fiscalYear: number;
  periodNumber: number;
  periodEndDate: Date;
  assetCategoryIds?: string[];
  assetIds?: string[];
  assetsProcessed: number;
  totalBookDepreciation: number;
  totalTaxAllowance: number;
  status: DepreciationRunStatus;
  isPosted: boolean;
  journalEntryId?: string;
  postedAt?: Date;
  postedBy?: string;
  createdBy: string;
  createdAt: Date;
}

export type DepreciationRunStatus =
  | 'draft'
  | 'confirmed'
  | 'posted'
  | 'reversed';

// ============================================
// ASSET DISPOSAL
// ============================================

export interface FixedAssetDisposal {
  id: string;
  companyId: string;
  assetId: string;
  disposalDate: Date;
  disposalMethod: AssetDisposalMethod;
  disposalReason?: string;
  proceedsAmount: number;
  proceedsCurrency: 'JMD' | 'USD';
  proceedsExchangeRate: number;
  proceedsAmountJMD: number;
  buyerId?: string;
  buyerName?: string;
  invoiceNumber?: string;
  bookCostAtDisposal: number;
  bookAccumulatedDepAtDisposal: number;
  bookNBVAtDisposal: number;
  taxCostAtDisposal: number;
  taxAccumulatedAllowancesAtDisposal: number;
  taxWDVAtDisposal: number;
  bookGainOrLoss: number;
  isBookGain: boolean;
  taxBalancingAmount: number;
  isBalancingCharge: boolean;
  balancingChargeCapped: boolean;
  isPosted: boolean;
  journalEntryId?: string;
  status: DisposalStatus;
  hasProofOfSale: boolean;
  hasTitleTransfer: boolean;
  attachmentIds?: string[];
  createdBy: string;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  postedBy?: string;
  postedAt?: Date;
}

export type DisposalStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'posted'
  | 'cancelled';

// ============================================
// CAPITAL ALLOWANCE SCHEDULE
// ============================================

export interface CapitalAllowanceSchedule {
  companyId: string;
  fiscalYear: number;
  classSummaries: CapitalAllowanceClassSummary[];
  totalOpeningWDV: number;
  totalAdditions: number;
  totalDisposals: number;
  totalInitialAllowance: number;
  totalAnnualAllowance: number;
  totalBalancingCharges: number;
  totalBalancingAllowances: number;
  totalClosingWDV: number;
  netCapitalAllowanceClaim: number;
  generatedAt: Date;
}

export interface CapitalAllowanceClassSummary {
  classCode: string;
  className: string;
  initialAllowanceRate: number;
  annualAllowanceRate: number;
  openingWDV: number;
  additions: number;
  disposalProceeds: number;
  initialAllowance: number;
  annualAllowance: number;
  balancingCharge: number;
  balancingAllowance: number;
  closingWDV: number;
  assetCount: number;
}
