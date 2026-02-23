// YaadBooks Web - Banking Type Definitions

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
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
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
  transactionDate: Date;
  postDate: Date;
  description: string;
  reference?: string;
  amount: number;
  balance?: number;
  category?: string;
  isReconciled: boolean;
  reconciledAt?: Date;
  reconciledBy?: string;
  matchedDocumentType?: 'invoice' | 'expense' | 'payment' | 'journal';
  matchedDocumentId?: string;
  journalEntryId?: string;
  importBatchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankReconciliation {
  id: string;
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  openingBalance: number;
  closingBalance: number;
  statementBalance: number;
  bookBalance: number;
  difference: number;
  status: ReconciliationStatus;
  reconciledTransactionIds: string[];
  adjustments: ReconciliationAdjustment[];
  completedAt?: Date;
  completedBy?: string;
  createdAt: Date;
  updatedAt: Date;
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
  importedAt: Date;
  importedBy: string;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}
