/**
 * YaadBooks Accounting Engine
 *
 * The brain of the accounting system. Automatically creates double-entry
 * journal entries when business events occur (invoice created, expense recorded,
 * payment received, payroll processed, etc.)
 *
 * Every financial transaction flows through this engine to ensure the
 * general ledger is always in sync.
 */
import prisma from '@/lib/db';
import { SYSTEM_ACCOUNTS, EXPENSE_CATEGORY_TO_ACCOUNT, DEFAULT_CHART_OF_ACCOUNTS } from './default-accounts';

// ─── Types ───────────────────────────────────────────────────────

interface JournalLineDraft {
  accountNumber: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
}

interface PostResult {
  success: boolean;
  journalEntryId?: string;
  entryNumber?: string;
  error?: string;
}

export type SourceModule =
  | 'INVOICE'
  | 'PAYMENT'
  | 'EXPENSE'
  | 'BILL'
  | 'BILL_PAYMENT'
  | 'PAYROLL'
  | 'REMITTANCE'
  | 'INVENTORY'
  | 'FIXED_ASSET'
  | 'DEPRECIATION'
  | 'GCT'
  | 'YEAR_END'
  | 'POS';

// ─── Account Resolution ──────────────────────────────────────────

/**
 * Resolves a system account number to its GL account ID for a company.
 * If the account doesn't exist, it creates it from the default chart.
 */
async function resolveAccountId(
  companyId: string,
  accountNumber: string,
  tx: any = prisma
): Promise<{ id: string; name: string } | null> {
  // Try to find existing account
  let account = await tx.gLAccount.findFirst({
    where: { companyId, accountNumber },
    select: { id: true, name: true },
  });

  if (account) return account;

  // Auto-create from defaults if this is a system account
  const defaultAccount = DEFAULT_CHART_OF_ACCOUNTS.find(
    (a) => a.accountNumber === accountNumber
  );
  if (!defaultAccount) return null;

  account = await tx.gLAccount.create({
    data: {
      companyId,
      accountNumber: defaultAccount.accountNumber,
      name: defaultAccount.name,
      type: defaultAccount.type,
      subType: defaultAccount.subType ?? null,
      normalBalance: defaultAccount.normalBalance,
      isSystemAccount: defaultAccount.isSystemAccount,
      isControlAccount: defaultAccount.isControlAccount,
      isTaxAccount: defaultAccount.isTaxAccount,
      isBankAccount: defaultAccount.isBankAccount,
      description: defaultAccount.description ?? null,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  return account;
}

/**
 * Resolves multiple account numbers to their IDs in bulk.
 * Returns a map of accountNumber → { id, name }
 */
async function resolveAccounts(
  companyId: string,
  accountNumbers: string[],
  tx: any = prisma
): Promise<Map<string, { id: string; name: string }>> {
  const map = new Map<string, { id: string; name: string }>();
  const unique = [...new Set(accountNumbers)];

  for (const num of unique) {
    const account = await resolveAccountId(companyId, num, tx);
    if (account) {
      map.set(num, account);
    }
  }

  return map;
}

// ─── Entry Number Generation ─────────────────────────────────────

async function generateEntryNumber(companyId: string, tx: any = prisma): Promise<string> {
  const count = await tx.journalEntry.count({ where: { companyId } });
  return `JE-${String(count + 1).padStart(5, '0')}`;
}

// ─── Core Posting Function ───────────────────────────────────────

/**
 * Creates a journal entry from a set of line drafts.
 * This is the central function all posting templates call.
 */
export async function postJournalEntry(params: {
  companyId: string;
  userId: string;
  date: Date;
  description: string;
  reference?: string;
  sourceModule: SourceModule;
  sourceDocumentId: string;
  sourceDocumentType?: string;
  lines: JournalLineDraft[];
  tx?: any;
}): Promise<PostResult> {
  const { companyId, userId, date, description, reference, sourceModule, sourceDocumentId, sourceDocumentType, lines } = params;
  const tx = params.tx ?? prisma;

  try {
    // Validate debits = credits
    const totalDebits = lines.reduce((sum, l) => sum + l.debitAmount, 0);
    const totalCredits = lines.reduce((sum, l) => sum + l.creditAmount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return {
        success: false,
        error: `Journal entry out of balance: debits=${totalDebits.toFixed(2)}, credits=${totalCredits.toFixed(2)}`,
      };
    }

    // Filter out zero-amount lines
    const nonZeroLines = lines.filter((l) => l.debitAmount > 0 || l.creditAmount > 0);
    if (nonZeroLines.length < 2) {
      return { success: false, error: 'Journal entry must have at least 2 non-zero lines' };
    }

    // Resolve all account numbers to IDs
    const accountNumbers = nonZeroLines.map((l) => l.accountNumber);
    const accountMap = await resolveAccounts(companyId, accountNumbers, tx);

    // Verify all accounts resolved
    for (const line of nonZeroLines) {
      if (!accountMap.has(line.accountNumber)) {
        return { success: false, error: `GL account not found: ${line.accountNumber}` };
      }
    }

    // Generate entry number
    const entryNumber = await generateEntryNumber(companyId, tx);

    // Create the journal entry with lines
    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        entryNumber,
        date,
        entryDate: new Date(),
        postDate: new Date(),
        description,
        reference: reference ?? null,
        sourceModule,
        sourceDocumentId,
        sourceDocumentType: sourceDocumentType ?? null,
        totalDebits,
        totalCredits,
        status: 'POSTED',
        createdById: userId,
        lines: {
          create: nonZeroLines.map((line, idx) => {
            const account = accountMap.get(line.accountNumber)!;
            return {
              lineNumber: idx + 1,
              accountId: account.id,
              accountCode: line.accountNumber,
              accountName: account.name,
              description: line.description,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              debitAmountJMD: line.debitAmount,
              creditAmountJMD: line.creditAmount,
            };
          }),
        },
      },
    });

    return { success: true, journalEntryId: entry.id, entryNumber };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post journal entry',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// POSTING TEMPLATES — Each business event has a template
// ═══════════════════════════════════════════════════════════════════

/**
 * POST: Invoice Created
 *
 * When an invoice is created (status SENT or DRAFT→SENT):
 *   DR  Accounts Receivable     (total including GCT)
 *   CR  Sales Revenue            (subtotal minus discount)
 *   CR  GCT Payable              (GCT amount)
 *   CR  Discount Given           (discount, if any — only for FIXED discounts)
 */
export async function postInvoiceCreated(params: {
  companyId: string;
  userId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  date: Date;
  subtotal: number;
  gctAmount: number;
  discount: number;
  total: number;
  tx?: any;
}): Promise<PostResult> {
  const { companyId, userId, invoiceId, invoiceNumber, customerName, date, subtotal, gctAmount, discount, total } = params;

  const lines: JournalLineDraft[] = [
    {
      accountNumber: SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      description: `Invoice ${invoiceNumber} — ${customerName}`,
      debitAmount: total,
      creditAmount: 0,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.SALES_REVENUE,
      description: `Sales — Invoice ${invoiceNumber}`,
      debitAmount: 0,
      creditAmount: subtotal - discount,
    },
  ];

  // GCT line (only if GCT > 0)
  if (gctAmount > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.GCT_PAYABLE,
      description: `GCT on Invoice ${invoiceNumber}`,
      debitAmount: 0,
      creditAmount: gctAmount,
    });
  }

  // Discount line (only if discount > 0 and it's part of the total)
  if (discount > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.DISCOUNT_GIVEN,
      description: `Discount on Invoice ${invoiceNumber}`,
      debitAmount: discount,
      creditAmount: 0,
    });
  }

  return postJournalEntry({
    companyId,
    userId,
    date,
    description: `Invoice ${invoiceNumber} — ${customerName}`,
    reference: invoiceNumber,
    sourceModule: 'INVOICE',
    sourceDocumentId: invoiceId,
    sourceDocumentType: 'Invoice',
    lines,
    tx: params.tx,
  });
}

/**
 * POST: Payment Received (on an invoice)
 *
 *   DR  Cash / Bank Account     (amount received)
 *   CR  Accounts Receivable     (amount applied to invoice)
 */
export async function postPaymentReceived(params: {
  companyId: string;
  userId: string;
  paymentId: string;
  invoiceNumber: string;
  customerName: string;
  date: Date;
  amount: number;
  paymentMethod: string;
  tx?: any;
}): Promise<PostResult> {
  const { companyId, userId, paymentId, invoiceNumber, customerName, date, amount, paymentMethod } = params;

  // Cash vs bank depends on payment method
  const cashAccountNumber =
    paymentMethod === 'CASH'
      ? SYSTEM_ACCOUNTS.CASH
      : SYSTEM_ACCOUNTS.BANK_ACCOUNT;

  const lines: JournalLineDraft[] = [
    {
      accountNumber: cashAccountNumber,
      description: `Payment received — Invoice ${invoiceNumber}`,
      debitAmount: amount,
      creditAmount: 0,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      description: `Payment from ${customerName} — Invoice ${invoiceNumber}`,
      debitAmount: 0,
      creditAmount: amount,
    },
  ];

  return postJournalEntry({
    companyId,
    userId,
    date,
    description: `Payment received from ${customerName} — Invoice ${invoiceNumber}`,
    reference: invoiceNumber,
    sourceModule: 'PAYMENT',
    sourceDocumentId: paymentId,
    sourceDocumentType: 'Payment',
    lines,
    tx: params.tx,
  });
}

/**
 * POST: Expense Recorded
 *
 *   DR  Expense Account          (amount net of claimable GCT)
 *   DR  GCT Input Tax Credit     (GCT amount, if claimable)
 *   CR  Cash / Bank Account      (total amount paid)
 */
export async function postExpenseCreated(params: {
  companyId: string;
  userId: string;
  expenseId: string;
  category: string;
  description: string;
  date: Date;
  amount: number;
  gctAmount: number;
  gctClaimable: boolean;
  paymentMethod: string;
  tx?: any;
}): Promise<PostResult> {
  const { companyId, userId, expenseId, category, description: desc, date, amount, gctAmount, gctClaimable, paymentMethod } = params;

  // Map expense category to GL account
  const expenseAccountNumber = EXPENSE_CATEGORY_TO_ACCOUNT[category] ?? SYSTEM_ACCOUNTS.MISCELLANEOUS_EXPENSE;

  // Cash vs bank
  const cashAccountNumber =
    paymentMethod === 'CASH'
      ? SYSTEM_ACCOUNTS.CASH
      : SYSTEM_ACCOUNTS.BANK_ACCOUNT;

  const lines: JournalLineDraft[] = [];

  if (gctClaimable && gctAmount > 0) {
    // Expense net of GCT + separate GCT input credit
    lines.push({
      accountNumber: expenseAccountNumber,
      description: desc,
      debitAmount: amount - gctAmount,
      creditAmount: 0,
    });
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.GCT_INPUT_TAX,
      description: `GCT input credit — ${desc}`,
      debitAmount: gctAmount,
      creditAmount: 0,
    });
  } else {
    // Full expense amount (GCT not claimable or no GCT)
    lines.push({
      accountNumber: expenseAccountNumber,
      description: desc,
      debitAmount: amount,
      creditAmount: 0,
    });
  }

  lines.push({
    accountNumber: cashAccountNumber,
    description: `Payment — ${desc}`,
    debitAmount: 0,
    creditAmount: amount,
  });

  return postJournalEntry({
    companyId,
    userId,
    date,
    description: `Expense: ${desc}`,
    sourceModule: 'EXPENSE',
    sourceDocumentId: expenseId,
    sourceDocumentType: 'Expense',
    lines,
    tx: params.tx,
  });
}

/**
 * POST: Payroll Run
 *
 * Creates a comprehensive journal entry for an entire payroll run:
 *   DR  Salary Expense           (total gross pay)
 *   DR  Employer Payroll Tax     (employer NIS + NHT + Ed Tax + HEART)
 *   CR  PAYE Payable             (total PAYE withheld)
 *   CR  NIS Payable (Employee)   (total employee NIS)
 *   CR  NHT Payable (Employee)   (total employee NHT)
 *   CR  Education Tax (Employee) (total employee Ed Tax)
 *   CR  NIS Payable (Employer)   (total employer NIS)
 *   CR  NHT Payable (Employer)   (total employer NHT)
 *   CR  Education Tax (Employer) (total employer Ed Tax)
 *   CR  HEART/NTA Payable        (total HEART contribution)
 *   CR  Salaries Payable         (total net pay to employees)
 */
export async function postPayrollRun(params: {
  companyId: string;
  userId: string;
  payrollRunId: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  totalGross: number;
  totalPaye: number;
  totalEmployeeNis: number;
  totalEmployeeNht: number;
  totalEmployeeEdTax: number;
  totalEmployerNis: number;
  totalEmployerNht: number;
  totalEmployerEdTax: number;
  totalHeart: number;
  totalNet: number;
  tx?: any;
}): Promise<PostResult> {
  const {
    companyId, userId, payrollRunId, periodStart, periodEnd, payDate,
    totalGross, totalPaye, totalEmployeeNis, totalEmployeeNht, totalEmployeeEdTax,
    totalEmployerNis, totalEmployerNht, totalEmployerEdTax, totalHeart, totalNet,
  } = params;

  const periodLabel = `${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`;
  const totalEmployerContributions = totalEmployerNis + totalEmployerNht + totalEmployerEdTax + totalHeart;

  const lines: JournalLineDraft[] = [
    // Debits
    {
      accountNumber: SYSTEM_ACCOUNTS.SALARY_EXPENSE,
      description: `Gross salaries — ${periodLabel}`,
      debitAmount: totalGross,
      creditAmount: 0,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.EMPLOYER_PAYROLL_TAX_EXPENSE,
      description: `Employer statutory contributions — ${periodLabel}`,
      debitAmount: totalEmployerContributions,
      creditAmount: 0,
    },
    // Credits — Employee deductions
    {
      accountNumber: SYSTEM_ACCOUNTS.PAYE_PAYABLE,
      description: `PAYE withheld — ${periodLabel}`,
      debitAmount: 0,
      creditAmount: totalPaye,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.NIS_PAYABLE,
      description: `Employee NIS — ${periodLabel}`,
      debitAmount: 0,
      creditAmount: totalEmployeeNis,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.NHT_PAYABLE,
      description: `Employee NHT — ${periodLabel}`,
      debitAmount: 0,
      creditAmount: totalEmployeeNht,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.EDUCATION_TAX_PAYABLE,
      description: `Employee Education Tax — ${periodLabel}`,
      debitAmount: 0,
      creditAmount: totalEmployeeEdTax,
    },
    // Credits — Employer contributions
    {
      accountNumber: SYSTEM_ACCOUNTS.EMPLOYER_NIS_PAYABLE,
      description: `Employer NIS — ${periodLabel}`,
      debitAmount: 0,
      creditAmount: totalEmployerNis,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.EMPLOYER_NHT_PAYABLE,
      description: `Employer NHT — ${periodLabel}`,
      debitAmount: 0,
      creditAmount: totalEmployerNht,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.EMPLOYER_EDUCATION_TAX_PAYABLE,
      description: `Employer Education Tax — ${periodLabel}`,
      debitAmount: 0,
      creditAmount: totalEmployerEdTax,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.HEART_NTA_PAYABLE,
      description: `HEART/NTA — ${periodLabel}`,
      debitAmount: 0,
      creditAmount: totalHeart,
    },
    // Credits — Net pay to employees
    {
      accountNumber: SYSTEM_ACCOUNTS.SALARIES_PAYABLE,
      description: `Net salaries payable — ${periodLabel}`,
      debitAmount: 0,
      creditAmount: totalNet,
    },
  ];

  return postJournalEntry({
    companyId,
    userId,
    date: payDate,
    description: `Payroll — ${periodLabel}`,
    reference: `PAYROLL-${periodLabel}`,
    sourceModule: 'PAYROLL',
    sourceDocumentId: payrollRunId,
    sourceDocumentType: 'PayrollRun',
    lines,
    tx: params.tx,
  });
}

/**
 * POST: POS Return Completed (reversal of sale)
 *
 * When a POS return is processed:
 *   DR  Sales Revenue (4000)           — return subtotal (reverse credit)
 *   DR  GCT Payable (2100)             — GCT on return (reverse credit)
 *   DR  Inventory (1200)               — restock cost (if items restocked)
 *   CR  Cash (1000) or Bank (1020)     — refund amount
 *   CR  COGS (5000)                    — restock cost reversal (if restocked)
 */
export async function postPosReturnCompleted(params: {
  companyId: string;
  userId: string;
  returnId: string;
  returnNumber: string;
  orderNumber: string;
  customerName: string;
  date: Date;
  subtotal: number;
  gctAmount: number;
  totalRefund: number;
  refundMethod: string;
  totalRestockCost: number;
  tx?: any;
}): Promise<PostResult> {
  const {
    companyId, userId, returnId, returnNumber, orderNumber, customerName, date,
    subtotal, gctAmount, totalRefund, refundMethod, totalRestockCost,
  } = params;

  const lines: JournalLineDraft[] = [];

  // ── Debits (reversing the original sale credits) ──

  // Reverse Sales Revenue
  if (subtotal > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.SALES_REVENUE,
      description: `Return ${returnNumber} — reversal of sales`,
      debitAmount: Math.round(subtotal * 100) / 100,
      creditAmount: 0,
    });
  }

  // Reverse GCT Payable
  if (gctAmount > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.GCT_PAYABLE,
      description: `GCT reversal — Return ${returnNumber}`,
      debitAmount: Math.round(gctAmount * 100) / 100,
      creditAmount: 0,
    });
  }

  // Inventory restock (debit inventory asset)
  if (totalRestockCost > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.INVENTORY,
      description: `Inventory restock — Return ${returnNumber}`,
      debitAmount: Math.round(totalRestockCost * 100) / 100,
      creditAmount: 0,
    });
  }

  // ── Credits (reversing the original sale debits) ──

  // Refund to customer (cash or bank)
  const refundAccount =
    refundMethod === 'CASH' ? SYSTEM_ACCOUNTS.CASH : SYSTEM_ACCOUNTS.BANK_ACCOUNT;

  lines.push({
    accountNumber: refundAccount,
    description: `Refund — Return ${returnNumber}`,
    debitAmount: 0,
    creditAmount: Math.round(totalRefund * 100) / 100,
  });

  // Reverse COGS (credit — reduces expense)
  if (totalRestockCost > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.COST_OF_GOODS_SOLD,
      description: `COGS reversal — Return ${returnNumber}`,
      debitAmount: 0,
      creditAmount: Math.round(totalRestockCost * 100) / 100,
    });
  }

  return postJournalEntry({
    companyId,
    userId,
    date,
    description: `POS Return ${returnNumber} — Order ${orderNumber} — ${customerName}`,
    reference: returnNumber,
    sourceModule: 'POS',
    sourceDocumentId: returnId,
    sourceDocumentType: 'PosReturn',
    lines,
    tx: params.tx,
  });
}

/**
 * POST: Invoice Cancelled / Voided
 *
 * Reverses the original invoice journal entry:
 *   DR  Sales Revenue
 *   DR  GCT Payable
 *   CR  Accounts Receivable
 */
export async function postInvoiceCancelled(params: {
  companyId: string;
  userId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  date: Date;
  subtotal: number;
  gctAmount: number;
  discount: number;
  total: number;
  tx?: any;
}): Promise<PostResult> {
  const { companyId, userId, invoiceId, invoiceNumber, customerName, date, subtotal, gctAmount, discount, total } = params;

  const lines: JournalLineDraft[] = [
    {
      accountNumber: SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      description: `Void Invoice ${invoiceNumber} — ${customerName}`,
      debitAmount: 0,
      creditAmount: total,
    },
    {
      accountNumber: SYSTEM_ACCOUNTS.SALES_REVENUE,
      description: `Reverse Sales — Invoice ${invoiceNumber}`,
      debitAmount: subtotal - discount,
      creditAmount: 0,
    },
  ];

  if (gctAmount > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.GCT_PAYABLE,
      description: `Reverse GCT — Invoice ${invoiceNumber}`,
      debitAmount: gctAmount,
      creditAmount: 0,
    });
  }

  if (discount > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.DISCOUNT_GIVEN,
      description: `Reverse Discount — Invoice ${invoiceNumber}`,
      debitAmount: 0,
      creditAmount: discount,
    });
  }

  return postJournalEntry({
    companyId,
    userId,
    date,
    description: `Void Invoice ${invoiceNumber} — ${customerName}`,
    reference: `VOID-${invoiceNumber}`,
    sourceModule: 'INVOICE',
    sourceDocumentId: invoiceId,
    sourceDocumentType: 'InvoiceVoid',
    lines,
    tx: params.tx,
  });
}

/**
 * POST: POS Order Completed
 *
 * When a POS order is fully paid and completed:
 *   DR  Cash (1000)               — cash payment portion
 *   DR  Bank Account (1020)       — card/digital payment portion
 *   DR  Discount Given (4900)     — order-level discount (if any)
 *   DR  Cost of Goods Sold (5000) — total product cost (if tracked)
 *   CR  Sales Revenue (4000)      — gross subtotal (before discount)
 *   CR  GCT Payable (2100)        — GCT collected
 *   CR  Inventory (1200)          — total product cost (if tracked)
 *
 * Unlike invoice posting (which goes through AR), POS sales are
 * immediate — cash/bank is debited directly.
 */
export async function postPosOrderCompleted(params: {
  companyId: string;
  userId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  date: Date;
  subtotal: number;
  gctAmount: number;
  orderDiscountAmount: number;
  total: number;
  cashAmount: number;
  nonCashAmount: number;
  totalCost: number;
  tx?: any;
}): Promise<PostResult> {
  const {
    companyId, userId, orderId, orderNumber, customerName, date,
    subtotal, gctAmount, orderDiscountAmount,
    cashAmount, nonCashAmount, totalCost,
  } = params;

  const lines: JournalLineDraft[] = [];

  // ── Debits ──

  // Cash received
  if (cashAmount > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.CASH,
      description: `POS Cash — Order ${orderNumber}`,
      debitAmount: Math.round(cashAmount * 100) / 100,
      creditAmount: 0,
    });
  }

  // Non-cash payments (card, JamDEX, Lynk, WiPay, bank transfer, etc.)
  if (nonCashAmount > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.BANK_ACCOUNT,
      description: `POS Card/Digital — Order ${orderNumber}`,
      debitAmount: Math.round(nonCashAmount * 100) / 100,
      creditAmount: 0,
    });
  }

  // Discount given (contra-revenue)
  if (orderDiscountAmount > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.DISCOUNT_GIVEN,
      description: `Discount — Order ${orderNumber}`,
      debitAmount: Math.round(orderDiscountAmount * 100) / 100,
      creditAmount: 0,
    });
  }

  // COGS (if products have cost price data)
  if (totalCost > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.COST_OF_GOODS_SOLD,
      description: `COGS — Order ${orderNumber}`,
      debitAmount: Math.round(totalCost * 100) / 100,
      creditAmount: 0,
    });
  }

  // ── Credits ──

  // Sales Revenue (gross subtotal before order-level discount)
  lines.push({
    accountNumber: SYSTEM_ACCOUNTS.SALES_REVENUE,
    description: `POS Sales — Order ${orderNumber}`,
    debitAmount: 0,
    creditAmount: Math.round(subtotal * 100) / 100,
  });

  // GCT collected
  if (gctAmount > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.GCT_PAYABLE,
      description: `GCT — Order ${orderNumber}`,
      debitAmount: 0,
      creditAmount: Math.round(gctAmount * 100) / 100,
    });
  }

  // Inventory reduction (mirrors COGS debit)
  if (totalCost > 0) {
    lines.push({
      accountNumber: SYSTEM_ACCOUNTS.INVENTORY,
      description: `Inventory sold — Order ${orderNumber}`,
      debitAmount: 0,
      creditAmount: Math.round(totalCost * 100) / 100,
    });
  }

  return postJournalEntry({
    companyId,
    userId,
    date,
    description: `POS Sale — Order ${orderNumber} — ${customerName}`,
    reference: orderNumber,
    sourceModule: 'POS',
    sourceDocumentId: orderId,
    sourceDocumentType: 'PosOrder',
    lines,
    tx: params.tx,
  });
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY: Seed default chart of accounts for a new company
// ═══════════════════════════════════════════════════════════════════

/**
 * Creates the default chart of accounts for a new company.
 * Called during company creation or on first use.
 * Skips accounts that already exist.
 */
export async function seedDefaultAccounts(companyId: string, tx: any = prisma): Promise<number> {
  let created = 0;

  for (const acct of DEFAULT_CHART_OF_ACCOUNTS) {
    const exists = await tx.gLAccount.findFirst({
      where: { companyId, accountNumber: acct.accountNumber },
    });

    if (!exists) {
      await tx.gLAccount.create({
        data: {
          companyId,
          accountNumber: acct.accountNumber,
          name: acct.name,
          type: acct.type,
          subType: acct.subType ?? null,
          normalBalance: acct.normalBalance,
          isSystemAccount: acct.isSystemAccount,
          isControlAccount: acct.isControlAccount,
          isTaxAccount: acct.isTaxAccount,
          isBankAccount: acct.isBankAccount,
          description: acct.description ?? null,
          isActive: true,
        },
      });
      created++;
    }
  }

  return created;
}
