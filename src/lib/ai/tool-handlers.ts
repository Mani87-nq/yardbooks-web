/**
 * AI Tool Handlers
 *
 * Server-side execution functions for each AI tool.
 * All handlers are scoped to the company ID for multi-tenant isolation.
 * Returns JSON strings for Claude to interpret.
 */
import prisma from '@/lib/db';
import { GCTRate } from '@prisma/client';

type ToolHandler = (companyId: string, input: Record<string, unknown>) => Promise<string>;

// ─── Helper ─────────────────────────────────────────────────────

/** Safely convert Prisma Decimal to number */
function d(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

/** Format currency for display */
function jmd(amount: number): string {
  return `J$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Tool Handlers ──────────────────────────────────────────────

const searchCustomers: ToolHandler = async (companyId, input) => {
  const query = input.query as string;
  const type = input.type as string | undefined;
  const limit = Math.min((input.limit as number) || 10, 50);

  const where: Record<string, unknown> = {
    companyId,
    deletedAt: null,
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
      { companyName: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query, mode: 'insensitive' } },
    ],
  };

  if (type && type !== 'BOTH') {
    where.type = type;
  }

  const customers = await prisma.customer.findMany({
    where: where as any,
    select: {
      id: true, name: true, email: true, phone: true, type: true,
      companyName: true, trnNumber: true, balance: true,
      addressStreet: true, addressCity: true, addressParish: true,
      _count: { select: { invoices: true } },
    },
    take: limit,
    orderBy: { name: 'asc' },
  });

  return JSON.stringify({
    count: customers.length,
    customers: customers.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      type: c.type,
      companyName: c.companyName,
      trnNumber: c.trnNumber,
      balance: d(c.balance),
      balanceFormatted: jmd(d(c.balance)),
      address: [c.addressStreet, c.addressCity, c.addressParish].filter(Boolean).join(', ') || null,
      invoiceCount: c._count.invoices,
    })),
  });
};

const getInvoiceDetails: ToolHandler = async (companyId, input) => {
  const invoiceNumber = input.invoiceNumber as string;

  const invoice = await prisma.invoice.findFirst({
    where: { companyId, invoiceNumber, deletedAt: null },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      items: { select: { description: true, quantity: true, unitPrice: true, total: true, gctRate: true, gctAmount: true } },
      payments: { select: { amount: true, paymentMethod: true, date: true, reference: true } },
    },
  });

  if (!invoice) {
    return JSON.stringify({ error: `Invoice ${invoiceNumber} not found` });
  }

  return JSON.stringify({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    customer: invoice.customer,
    issueDate: invoice.createdAt,
    dueDate: invoice.dueDate,
    subtotal: d(invoice.subtotal),
    gctAmount: d(invoice.gctAmount),
    total: d(invoice.total),
    totalFormatted: jmd(d(invoice.total)),
    amountPaid: d(invoice.amountPaid),
    balance: d(invoice.balance),
    balanceFormatted: jmd(d(invoice.balance)),
    items: invoice.items.map(i => ({
      description: i.description,
      quantity: d(i.quantity),
      unitPrice: d(i.unitPrice),
      total: d(i.total),
      gctRate: i.gctRate,
      gctAmount: d(i.gctAmount),
    })),
    payments: invoice.payments.map(p => ({
      amount: d(p.amount),
      amountFormatted: jmd(d(p.amount)),
      method: p.paymentMethod,
      date: p.date,
      reference: p.reference,
    })),
    notes: invoice.notes,
  });
};

const listInvoices: ToolHandler = async (companyId, input) => {
  const status = input.status as string | undefined;
  const customerId = input.customerId as string | undefined;
  const dateFrom = input.dateFrom as string | undefined;
  const dateTo = input.dateTo as string | undefined;
  const limit = Math.min((input.limit as number) || 20, 50);

  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
  }

  const invoices = await prisma.invoice.findMany({
    where: where as any,
    select: {
      id: true, invoiceNumber: true, status: true, total: true,
      balance: true, dueDate: true, createdAt: true,
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const totals = await prisma.invoice.aggregate({
    where: where as any,
    _sum: { total: true, balance: true },
    _count: true,
  });

  return JSON.stringify({
    count: invoices.length,
    totalMatchingCount: totals._count,
    totalAmount: d(totals._sum.total),
    totalAmountFormatted: jmd(d(totals._sum.total)),
    totalOutstanding: d(totals._sum.balance),
    totalOutstandingFormatted: jmd(d(totals._sum.balance)),
    invoices: invoices.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      status: i.status,
      customer: i.customer?.name || 'Unknown',
      total: d(i.total),
      totalFormatted: jmd(d(i.total)),
      balance: d(i.balance),
      balanceFormatted: jmd(d(i.balance)),
      dueDate: i.dueDate,
      createdAt: i.createdAt,
    })),
  });
};

const listExpenses: ToolHandler = async (companyId, input) => {
  const category = input.category as string | undefined;
  const dateFrom = input.dateFrom as string | undefined;
  const dateTo = input.dateTo as string | undefined;
  const vendor = input.vendor as string | undefined;
  const limit = Math.min((input.limit as number) || 20, 50);

  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (category) where.category = category;
  if (vendor) where.vendor = { name: { contains: vendor, mode: 'insensitive' } };
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
  }

  const expenses = await prisma.expense.findMany({
    where: where as any,
    select: {
      id: true, description: true, amount: true, category: true,
      vendor: { select: { name: true } }, date: true, gctAmount: true, paymentMethod: true,
      receiptUrl: true,
    },
    orderBy: { date: 'desc' },
    take: limit,
  });

  const totals = await prisma.expense.aggregate({
    where: where as any,
    _sum: { amount: true, gctAmount: true },
    _count: true,
  });

  return JSON.stringify({
    count: expenses.length,
    totalMatchingCount: totals._count,
    totalAmount: d(totals._sum.amount),
    totalAmountFormatted: jmd(d(totals._sum.amount)),
    totalGCT: d(totals._sum.gctAmount),
    expenses: expenses.map(e => ({
      id: e.id,
      description: e.description,
      amount: d(e.amount),
      amountFormatted: jmd(d(e.amount)),
      category: e.category,
      vendor: e.vendor?.name || null,
      date: e.date,
      gctAmount: d(e.gctAmount),
      paymentMethod: e.paymentMethod,
      hasReceipt: !!e.receiptUrl,
    })),
  });
};

const getChartOfAccounts: ToolHandler = async (companyId, input) => {
  const type = input.type as string | undefined;
  const activeOnly = input.activeOnly !== false; // default true

  const where: Record<string, unknown> = { companyId };
  if (type) where.type = type;
  if (activeOnly) where.isActive = true;

  const accounts = await prisma.gLAccount.findMany({
    where: where as any,
    select: {
      id: true, code: true, name: true, type: true, subType: true,
      currentBalance: true, isActive: true, description: true,
    },
    orderBy: { code: 'asc' },
  });

  return JSON.stringify({
    count: accounts.length,
    accounts: accounts.map(a => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subType: a.subType,
      currentBalance: d(a.currentBalance),
      balanceFormatted: jmd(d(a.currentBalance)),
      isActive: a.isActive,
      description: a.description,
    })),
  });
};

const getGeneralLedger: ToolHandler = async (companyId, input) => {
  const startDate = new Date(input.startDate as string);
  const endDate = new Date(input.endDate as string);
  const accountId = input.accountId as string | undefined;
  const accountCode = input.accountCode as string | undefined;

  // If account code is provided, resolve to ID
  let resolvedAccountId = accountId;
  if (!resolvedAccountId && accountCode) {
    const account = await prisma.gLAccount.findFirst({
      where: { companyId, code: accountCode },
      select: { id: true },
    });
    resolvedAccountId = account?.id;
  }

  const where: Record<string, unknown> = {
    companyId,
    date: { gte: startDate, lte: endDate },
    status: 'POSTED',
  };

  const entries = await prisma.journalEntry.findMany({
    where: where as any,
    select: {
      id: true, entryNumber: true, date: true, description: true,
      sourceModule: true, sourceDocumentId: true, totalDebits: true, totalCredits: true,
      lines: {
        select: {
          description: true, debitAmount: true, creditAmount: true,
          account: { select: { code: true, name: true, id: true } },
        },
        ...(resolvedAccountId ? { where: { accountId: resolvedAccountId } } : {}),
      },
    },
    orderBy: { date: 'asc' },
    take: 100,
  });

  // Filter out entries with no matching lines if account filter is active
  const filtered = resolvedAccountId
    ? entries.filter(e => e.lines.length > 0)
    : entries;

  return JSON.stringify({
    count: filtered.length,
    period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    entries: filtered.map(e => ({
      entryNumber: e.entryNumber,
      date: e.date,
      description: e.description,
      sourceModule: e.sourceModule,
      totalDebits: d(e.totalDebits),
      totalCredits: d(e.totalCredits),
      lines: e.lines.map(l => ({
        accountCode: l.account.code,
        accountName: l.account.name,
        description: l.description,
        debit: d(l.debitAmount),
        credit: d(l.creditAmount),
      })),
    })),
  });
};

const getTrialBalance: ToolHandler = async (companyId, input) => {
  const asOfDate = input.asOfDate ? new Date(input.asOfDate as string) : new Date();

  const accounts = await prisma.gLAccount.findMany({
    where: { companyId, isActive: true },
    select: {
      code: true, name: true, type: true, currentBalance: true,
    },
    orderBy: { code: 'asc' },
  });

  let totalDebits = 0;
  let totalCredits = 0;

  const rows = accounts
    .filter(a => d(a.currentBalance) !== 0)
    .map(a => {
      const balance = d(a.currentBalance);
      const isDebitNature = ['ASSET', 'EXPENSE'].includes(a.type);
      const debit = isDebitNature ? Math.max(balance, 0) : Math.max(-balance, 0);
      const credit = isDebitNature ? Math.max(-balance, 0) : Math.max(balance, 0);
      totalDebits += debit;
      totalCredits += credit;
      return {
        code: a.code,
        name: a.name,
        type: a.type,
        debit,
        credit,
        debitFormatted: debit ? jmd(debit) : '',
        creditFormatted: credit ? jmd(credit) : '',
      };
    });

  return JSON.stringify({
    asOfDate: asOfDate.toISOString(),
    totalDebits,
    totalDebitsFormatted: jmd(totalDebits),
    totalCredits,
    totalCreditsFormatted: jmd(totalCredits),
    balanced: Math.abs(totalDebits - totalCredits) < 0.01,
    difference: Math.abs(totalDebits - totalCredits),
    accounts: rows,
  });
};

const getProfitLoss: ToolHandler = async (companyId, input) => {
  const startDate = new Date(input.startDate as string);
  const endDate = new Date(input.endDate as string);

  // Get revenue and expense accounts with their balances
  const accounts = await prisma.gLAccount.findMany({
    where: { companyId, isActive: true, type: { in: ['INCOME', 'EXPENSE'] } },
    select: { code: true, name: true, type: true, subType: true, currentBalance: true },
    orderBy: { code: 'asc' },
  });

  const revenue = accounts.filter(a => a.type === 'INCOME');
  const expenses = accounts.filter(a => a.type === 'EXPENSE');

  const totalRevenue = revenue.reduce((sum, a) => sum + d(a.currentBalance), 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + d(a.currentBalance), 0);
  const netIncome = totalRevenue - totalExpenses;

  return JSON.stringify({
    period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    revenue: {
      total: totalRevenue,
      totalFormatted: jmd(totalRevenue),
      accounts: revenue.map(a => ({
        code: a.code, name: a.name, subType: a.subType,
        balance: d(a.currentBalance), balanceFormatted: jmd(d(a.currentBalance)),
      })),
    },
    expenses: {
      total: totalExpenses,
      totalFormatted: jmd(totalExpenses),
      accounts: expenses.map(a => ({
        code: a.code, name: a.name, subType: a.subType,
        balance: d(a.currentBalance), balanceFormatted: jmd(d(a.currentBalance)),
      })),
    },
    netIncome,
    netIncomeFormatted: jmd(netIncome),
    profitable: netIncome > 0,
  });
};

const getBalanceSheet: ToolHandler = async (companyId, input) => {
  const asOfDate = input.asOfDate ? new Date(input.asOfDate as string) : new Date();

  const accounts = await prisma.gLAccount.findMany({
    where: { companyId, isActive: true, type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } },
    select: { code: true, name: true, type: true, subType: true, currentBalance: true },
    orderBy: { code: 'asc' },
  });

  const assets = accounts.filter(a => a.type === 'ASSET');
  const liabilities = accounts.filter(a => a.type === 'LIABILITY');
  const equity = accounts.filter(a => a.type === 'EQUITY');

  const totalAssets = assets.reduce((sum, a) => sum + d(a.currentBalance), 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + d(a.currentBalance), 0);
  const totalEquity = equity.reduce((sum, a) => sum + d(a.currentBalance), 0);

  const mapAccounts = (arr: typeof accounts) => arr.map(a => ({
    code: a.code, name: a.name, subType: a.subType,
    balance: d(a.currentBalance), balanceFormatted: jmd(d(a.currentBalance)),
  }));

  return JSON.stringify({
    asOfDate: asOfDate.toISOString(),
    assets: { total: totalAssets, totalFormatted: jmd(totalAssets), accounts: mapAccounts(assets) },
    liabilities: { total: totalLiabilities, totalFormatted: jmd(totalLiabilities), accounts: mapAccounts(liabilities) },
    equity: { total: totalEquity, totalFormatted: jmd(totalEquity), accounts: mapAccounts(equity) },
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  });
};

const searchProducts: ToolHandler = async (companyId, input) => {
  const query = input.query as string | undefined;
  const category = input.category as string | undefined;
  const lowStockOnly = input.lowStockOnly as boolean | undefined;
  const limit = Math.min((input.limit as number) || 20, 50);

  const where: Record<string, unknown> = { companyId, deletedAt: null };

  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { sku: { contains: query, mode: 'insensitive' } },
      { barcode: { contains: query, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;

  let products = await prisma.product.findMany({
    where: where as any,
    select: {
      id: true, name: true, sku: true, barcode: true, category: true,
      unitPrice: true, costPrice: true, quantity: true, reorderLevel: true,
      isActive: true, description: true,
    },
    orderBy: { name: 'asc' },
    take: lowStockOnly ? 200 : limit, // Fetch more if filtering
  });

  if (lowStockOnly) {
    products = products.filter(p => d(p.quantity) <= d(p.reorderLevel || 0));
    products = products.slice(0, limit);
  }

  const totalValue = products.reduce((sum, p) => sum + (d(p.unitPrice) * d(p.quantity)), 0);

  return JSON.stringify({
    count: products.length,
    totalInventoryValue: totalValue,
    totalInventoryValueFormatted: jmd(totalValue),
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      unitPrice: d(p.unitPrice),
      unitPriceFormatted: jmd(d(p.unitPrice)),
      costPrice: d(p.costPrice),
      quantity: d(p.quantity),
      reorderLevel: d(p.reorderLevel),
      isLowStock: d(p.quantity) <= d(p.reorderLevel || 0),
      isActive: p.isActive,
    })),
  });
};

const listEmployees: ToolHandler = async (companyId, input) => {
  const activeOnly = input.activeOnly !== false;
  const limit = Math.min((input.limit as number) || 50, 100);

  const where: Record<string, unknown> = { companyId };
  if (activeOnly) where.isActive = true;

  const employees = await prisma.employee.findMany({
    where: where as any,
    select: {
      id: true, firstName: true, lastName: true, email: true,
      position: true, department: true, baseSalary: true,
      isActive: true, nisNumber: true, trnNumber: true,
      paymentFrequency: true, hireDate: true,
    },
    orderBy: { lastName: 'asc' },
    take: limit,
  });

  return JSON.stringify({
    count: employees.length,
    totalMonthlySalary: employees.reduce((sum, e) => sum + d(e.baseSalary), 0),
    totalMonthlySalaryFormatted: jmd(employees.reduce((sum, e) => sum + d(e.baseSalary), 0)),
    employees: employees.map(e => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      email: e.email,
      position: e.position,
      department: e.department,
      baseSalary: d(e.baseSalary),
      baseSalaryFormatted: jmd(d(e.baseSalary)),
      isActive: e.isActive,
      hasNIS: !!e.nisNumber,
      hasTRN: !!e.trnNumber,
      payFrequency: e.paymentFrequency,
      hireDate: e.hireDate,
    })),
  });
};

const getPayrollSummary: ToolHandler = async (companyId, input) => {
  const limit = Math.min((input.limit as number) || 6, 24);

  const runs = await prisma.payrollRun.findMany({
    where: { companyId },
    select: {
      id: true, periodStart: true, periodEnd: true, status: true,
      totalGross: true, totalDeductions: true, totalNet: true,
      payDate: true, _count: { select: { entries: true } },
    },
    orderBy: { periodEnd: 'desc' },
    take: limit,
  });

  return JSON.stringify({
    count: runs.length,
    runs: runs.map(r => ({
      id: r.id,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      status: r.status,
      employeeCount: r._count.entries,
      totalGross: d(r.totalGross),
      totalGrossFormatted: jmd(d(r.totalGross)),
      totalDeductions: d(r.totalDeductions),
      totalDeductionsFormatted: jmd(d(r.totalDeductions)),
      totalNet: d(r.totalNet),
      totalNetFormatted: jmd(d(r.totalNet)),
      payDate: r.payDate,
    })),
  });
};

const getBankAccounts: ToolHandler = async (companyId) => {
  const accounts = await prisma.bankAccount.findMany({
    where: { companyId },
    select: {
      id: true, accountName: true, bankName: true, accountNumber: true,
      accountType: true, currentBalance: true, currency: true,
      _count: { select: { transactions: true } },
    },
    orderBy: { accountName: 'asc' },
  });

  const totalBalance = accounts.reduce((sum, a) => sum + d(a.currentBalance), 0);

  return JSON.stringify({
    count: accounts.length,
    totalBalance,
    totalBalanceFormatted: jmd(totalBalance),
    accounts: accounts.map(a => ({
      id: a.id,
      accountName: a.accountName,
      bankName: a.bankName,
      accountNumber: a.accountNumber ? `****${a.accountNumber.slice(-4)}` : '',
      accountType: a.accountType,
      currentBalance: d(a.currentBalance),
      balanceFormatted: jmd(d(a.currentBalance)),
      currency: a.currency,
      transactionCount: a._count.transactions,
    })),
  });
};

const getAgingReport: ToolHandler = async (companyId, input) => {
  const type = input.type as 'receivable' | 'payable';
  const now = new Date();

  if (type === 'receivable') {
    // Get all outstanding invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'] },
      },
      select: {
        invoiceNumber: true, total: true, balance: true, dueDate: true,
        customer: { select: { name: true } },
      },
    });

    const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    const details: Array<Record<string, unknown>> = [];

    for (const inv of invoices) {
      const balance = d(inv.balance);
      if (balance <= 0) continue;

      const daysOverdue = inv.dueDate
        ? Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (daysOverdue <= 0) buckets.current += balance;
      else if (daysOverdue <= 30) buckets.days1to30 += balance;
      else if (daysOverdue <= 60) buckets.days31to60 += balance;
      else if (daysOverdue <= 90) buckets.days61to90 += balance;
      else buckets.over90 += balance;

      details.push({
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer?.name || 'Unknown',
        balance,
        balanceFormatted: jmd(balance),
        dueDate: inv.dueDate,
        daysOverdue: Math.max(daysOverdue, 0),
      });
    }

    const total = Object.values(buckets).reduce((a, b) => a + b, 0);

    return JSON.stringify({
      type: 'Accounts Receivable',
      total,
      totalFormatted: jmd(total),
      buckets: {
        current: { amount: buckets.current, formatted: jmd(buckets.current) },
        '1-30 days': { amount: buckets.days1to30, formatted: jmd(buckets.days1to30) },
        '31-60 days': { amount: buckets.days31to60, formatted: jmd(buckets.days31to60) },
        '61-90 days': { amount: buckets.days61to90, formatted: jmd(buckets.days61to90) },
        '90+ days': { amount: buckets.over90, formatted: jmd(buckets.over90) },
      },
      details: details.sort((a, b) => (b.daysOverdue as number) - (a.daysOverdue as number)).slice(0, 30),
    });
  } else {
    // Payable aging — use AP liability accounts
    // Since there's no Bill model, we report based on vendor-type customer balances
    const vendors = await prisma.customer.findMany({
      where: {
        companyId,
        deletedAt: null,
        type: { in: ['vendor', 'both'] },
      },
      select: {
        name: true, balance: true,
      },
    });

    const totalPayable = vendors.reduce((sum, v) => sum + Math.abs(d(v.balance)), 0);

    return JSON.stringify({
      type: 'Accounts Payable',
      total: totalPayable,
      totalFormatted: jmd(totalPayable),
      note: 'AP aging is based on vendor balances. Detailed aging by invoice is available for Accounts Receivable.',
      vendors: vendors
        .filter(v => d(v.balance) !== 0)
        .map(v => ({
          vendor: v.name,
          balance: Math.abs(d(v.balance)),
          balanceFormatted: jmd(Math.abs(d(v.balance))),
        }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 30),
    });
  }
};

const createDraftInvoice: ToolHandler = async (companyId, input) => {
  let customerId = input.customerId as string | undefined;
  const customerName = input.customerName as string | undefined;
  const items = input.items as Array<{
    description: string; quantity: number; unitPrice: number; gctRate?: string;
  }>;
  const notes = input.notes as string | undefined;
  const dueDate = input.dueDate as string | undefined;

  // Resolve customer by name if no ID provided
  if (!customerId && customerName) {
    const customer = await prisma.customer.findFirst({
      where: {
        companyId,
        deletedAt: null,
        name: { contains: customerName, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });
    if (!customer) {
      return JSON.stringify({
        error: `Customer "${customerName}" not found. Please check the name or create the customer first.`,
      });
    }
    customerId = customer.id;
  }

  if (!customerId) {
    return JSON.stringify({
      error: 'Please provide either a customer ID or customer name.',
    });
  }

  if (!items || items.length === 0) {
    return JSON.stringify({ error: 'At least one line item is required.' });
  }

  // Calculate totals
  const GCT_RATE = 0.15;
  let subtotal = 0;
  let gctAmount = 0;

  const invoiceItems = items.map(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const validRates: string[] = ['STANDARD', 'TELECOM', 'TOURISM', 'ZERO_RATED', 'EXEMPT'];
    const rateStr = (item.gctRate && validRates.includes(item.gctRate as string)) ? item.gctRate as string : 'STANDARD';
    const rate: GCTRate = rateStr as GCTRate;
    const lineGCT = rate === 'STANDARD' ? lineTotal * GCT_RATE
      : rate === 'TELECOM' ? lineTotal * 0.15
      : rate === 'TOURISM' ? lineTotal * 0.10
      : 0; // ZERO_RATED and EXEMPT
    subtotal += lineTotal;
    gctAmount += lineGCT;

    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: lineTotal,
      gctRate: rate,
      gctAmount: lineGCT,
    };
  });

  const total = subtotal + gctAmount;

  // Get next invoice number
  const lastInvoice = await prisma.invoice.findFirst({
    where: { companyId },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  const nextNum = lastInvoice?.invoiceNumber
    ? `INV-${String(parseInt(lastInvoice.invoiceNumber.replace('INV-', '')) + 1).padStart(4, '0')}`
    : 'INV-0001';

  // Create the draft invoice
  const invoice = await prisma.invoice.create({
    data: {
      companyId,
      customerId,
      invoiceNumber: nextNum,
      status: 'DRAFT',
      subtotal,
      gctAmount,
      total,
      balance: total,
      amountPaid: 0,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      notes: notes || null,
      items: {
        create: invoiceItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          gctRate: item.gctRate,
          gctAmount: item.gctAmount,
        })),
      },
    },
    include: {
      customer: { select: { name: true } },
      items: true,
    },
  });

  return JSON.stringify({
    success: true,
    message: `Draft invoice ${nextNum} created for ${invoice.customer?.name || 'customer'}. Total: ${jmd(total)}. Please review it in the Invoices section before sending.`,
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: 'DRAFT',
      customer: invoice.customer?.name,
      subtotal,
      gctAmount,
      total,
      totalFormatted: jmd(total),
      dueDate: invoice.dueDate,
      itemCount: invoiceItems.length,
      url: `/invoices/${invoice.id}`,
    },
  });
};

const getPosDailySales: ToolHandler = async (companyId, input) => {
  const dateStr = input.date as string | undefined;
  const date = dateStr ? new Date(dateStr) : new Date();
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const orders = await prisma.posOrder.findMany({
    where: {
      companyId,
      createdAt: { gte: startOfDay, lt: endOfDay },
      status: 'COMPLETED',
    },
    select: {
      id: true, orderNumber: true, total: true,
      createdAt: true, itemCount: true,
      payments: { select: { method: true, amount: true } },
    },
  });

  const totalSales = orders.reduce((sum, o) => sum + d(o.total), 0);
  const paymentBreakdown: Record<string, number> = {};
  for (const order of orders) {
    if (order.payments.length > 0) {
      for (const payment of order.payments) {
        const method = payment.method || 'CASH';
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + d(payment.amount);
      }
    } else {
      paymentBreakdown['CASH'] = (paymentBreakdown['CASH'] || 0) + d(order.total);
    }
  }

  return JSON.stringify({
    date: startOfDay.toISOString().split('T')[0],
    totalSales,
    totalSalesFormatted: jmd(totalSales),
    orderCount: orders.length,
    averageOrderValue: orders.length > 0 ? totalSales / orders.length : 0,
    averageOrderValueFormatted: orders.length > 0 ? jmd(totalSales / orders.length) : jmd(0),
    paymentBreakdown: Object.entries(paymentBreakdown).map(([method, amount]) => ({
      method,
      amount,
      amountFormatted: jmd(amount),
    })),
  });
};

// ─── Handler Registry ───────────────────────────────────────────

export const toolHandlers: Record<string, ToolHandler> = {
  search_customers: searchCustomers,
  get_invoice_details: getInvoiceDetails,
  list_invoices: listInvoices,
  list_expenses: listExpenses,
  get_chart_of_accounts: getChartOfAccounts,
  get_general_ledger: getGeneralLedger,
  get_trial_balance: getTrialBalance,
  get_profit_loss: getProfitLoss,
  get_balance_sheet: getBalanceSheet,
  search_products: searchProducts,
  list_employees: listEmployees,
  get_payroll_summary: getPayrollSummary,
  get_bank_accounts: getBankAccounts,
  get_aging_report: getAgingReport,
  create_draft_invoice: createDraftInvoice,
  get_pos_daily_sales: getPosDailySales,
};

/**
 * Execute a tool by name with company scoping.
 */
export async function executeTool(
  toolName: string,
  companyId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const handler = toolHandlers[toolName];
  if (!handler) {
    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
  try {
    return await handler(companyId, input);
  } catch (error) {
    console.error(`[AI Tool] ${toolName} error:`, error);
    return JSON.stringify({
      error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
