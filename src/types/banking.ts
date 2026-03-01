// YaadBooks Web - Banking Type Definitions
//
// NOTE: All date fields are typed as `string` (ISO 8601 format) because
// API responses serialize dates via NextResponse.json(). Use `new Date(field)`
// when you need Date arithmetic in a component.

export interface BankAccount {
  id: string;
  companyId: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  accountType: BankAccountType;
  currency: 'JMD' | 'USD';
  currentBalance: number;
  availableBalance: number;
  linkedGLAccountCode?: string;
  isActive: boolean;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type BankAccountType =
  | 'checking'
  | 'savings'
  | 'money_market'
  | 'credit_card'
  | 'loan'
  | 'other';

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  transactionDate: string;
  postDate: string;
  description: string;
  reference?: string;
  amount: number;
  balance?: number;
  category?: string;
  isReconciled: boolean;
  reconciledAt?: string;
  reconciledBy?: string;
  matchedDocumentType?: 'invoice' | 'expense' | 'payment' | 'journal';
  matchedDocumentId?: string;
  journalEntryId?: string;
  importBatchId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankReconciliation {
  id: string;
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  statementBalance: number;
  bookBalance: number;
  difference: number;
  status: ReconciliationStatus;
  reconciledTransactionIds: string[];
  adjustments: ReconciliationAdjustment[];
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReconciliationStatus =
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface ReconciliationAdjustment {
  id: string;
  description: string;
  amount: number;
  type: 'book' | 'bank';
  journalEntryId?: string;
}

export interface ImportBatch {
  id: string;
  bankAccountId: string;
  fileName: string;
  fileType: 'csv' | 'ofx' | 'qfx';
  transactionCount: number;
  importedAt: string;
  importedBy: string;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}
