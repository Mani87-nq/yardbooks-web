/**
 * AI Tool Definitions for Claude tool_use
 *
 * Each tool maps to a Prisma query or existing API logic.
 * All tools are executed server-side with company scoping.
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages';

export const AI_TOOLS: Tool[] = [
  {
    name: 'search_customers',
    description: 'Search for customers or vendors by name, email, or company name. Returns customer details including outstanding balance and contact info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term (name, email, or company name)' },
        type: { type: 'string', enum: ['CUSTOMER', 'VENDOR', 'BOTH'], description: 'Filter by type. Default: BOTH' },
        limit: { type: 'number', description: 'Max results to return (default 10, max 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_invoice_details',
    description: 'Get full details of a specific invoice by invoice number (e.g., INV-0001). Includes line items, payments, customer info, and status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceNumber: { type: 'string', description: 'The invoice number, e.g., INV-0001' },
      },
      required: ['invoiceNumber'],
    },
  },
  {
    name: 'list_invoices',
    description: 'List invoices with optional filters by status, customer, or date range. Returns summary data with totals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'], description: 'Filter by invoice status' },
        customerId: { type: 'string', description: 'Filter by customer ID' },
        dateFrom: { type: 'string', description: 'Start date filter (ISO format YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date filter (ISO format YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Max results (default 20, max 50)' },
      },
    },
  },
  {
    name: 'list_expenses',
    description: 'List business expenses with optional filters by category, date range, or vendor. Returns expense details with amounts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Filter by expense category' },
        dateFrom: { type: 'string', description: 'Start date (ISO format)' },
        dateTo: { type: 'string', description: 'End date (ISO format)' },
        vendor: { type: 'string', description: 'Filter by vendor name (partial match)' },
        limit: { type: 'number', description: 'Max results (default 20, max 50)' },
      },
    },
  },
  {
    name: 'get_chart_of_accounts',
    description: 'Get the full chart of accounts (general ledger accounts) with current balances. Can filter by account type (Asset, Liability, Equity, Revenue, Expense).',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'], description: 'Filter by account type (INCOME = Revenue accounts)' },
        activeOnly: { type: 'boolean', description: 'Only show active accounts (default true)' },
      },
    },
  },
  {
    name: 'get_general_ledger',
    description: 'Get general ledger journal entries for a date range, optionally filtered by GL account. Shows transaction-level detail with debits, credits, and descriptions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startDate: { type: 'string', description: 'Start date (ISO format, required)' },
        endDate: { type: 'string', description: 'End date (ISO format, required)' },
        accountId: { type: 'string', description: 'Filter to a specific GL account ID' },
        accountCode: { type: 'string', description: 'Filter to a specific GL account code (e.g., "1000")' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'get_trial_balance',
    description: 'Get the trial balance showing debit and credit totals for each GL account. Verifies that total debits equal total credits.',
    input_schema: {
      type: 'object' as const,
      properties: {
        asOfDate: { type: 'string', description: 'As-of date (ISO format). Defaults to today.' },
      },
    },
  },
  {
    name: 'get_profit_loss',
    description: 'Get the profit and loss (income) statement for a date range. Shows revenue, cost of goods sold, expenses, and net income.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startDate: { type: 'string', description: 'Start of period (ISO format, required)' },
        endDate: { type: 'string', description: 'End of period (ISO format, required)' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'get_balance_sheet',
    description: 'Get the balance sheet as of a specific date. Shows assets, liabilities, and equity with totals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        asOfDate: { type: 'string', description: 'As-of date (ISO format). Defaults to today.' },
      },
    },
  },
  {
    name: 'search_products',
    description: 'Search inventory products by name, SKU, barcode, or category. Shows stock levels, prices, and reorder status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term (name, SKU, or barcode)' },
        category: { type: 'string', description: 'Filter by product category' },
        lowStockOnly: { type: 'boolean', description: 'Only show items at or below reorder level' },
        limit: { type: 'number', description: 'Max results (default 20, max 50)' },
      },
    },
  },
  {
    name: 'list_employees',
    description: 'List employees with basic payroll information. Can filter by active status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        activeOnly: { type: 'boolean', description: 'Only show active employees (default true)' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
    },
  },
  {
    name: 'get_payroll_summary',
    description: 'Get recent payroll run summaries with gross pay, deductions breakdown, and net pay totals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Number of recent payroll runs to return (default 6, max 24)' },
      },
    },
  },
  {
    name: 'get_bank_accounts',
    description: 'Get all bank account balances, types, and reconciliation status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_aging_report',
    description: 'Get accounts receivable (AR) or accounts payable (AP) aging report. Shows amounts due by age bucket (current, 1-30, 31-60, 61-90, 90+ days).',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['receivable', 'payable'], description: 'Type of aging report: receivable (AR) or payable (AP)' },
      },
      required: ['type'],
    },
  },
  {
    name: 'create_draft_invoice',
    description: 'Create a DRAFT invoice for a customer. The invoice is NOT sent — the user must review and send it manually from the Invoices page. Always confirm the details with the user before creating.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer ID to invoice' },
        customerName: { type: 'string', description: 'Customer name (used to look up ID if customerId not provided)' },
        items: {
          type: 'array',
          description: 'Invoice line items',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Line item description' },
              quantity: { type: 'number', description: 'Quantity' },
              unitPrice: { type: 'number', description: 'Unit price in JMD' },
              gctRate: { type: 'string', enum: ['STANDARD', 'ZERO_RATED', 'EXEMPT'], description: 'GCT tax rate (default STANDARD = 15%)' },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
        },
        notes: { type: 'string', description: 'Invoice notes' },
        dueDate: { type: 'string', description: 'Due date (ISO format)' },
      },
      required: ['items'],
    },
  },
  {
    name: 'get_pos_daily_sales',
    description: 'Get POS (point of sale) daily sales summary for a specific date. Shows total sales, order count, payment method breakdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date to query (ISO format). Defaults to today.' },
      },
    },
  },
];

/**
 * Friendly display names for tools (used in UI)
 */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  search_customers: 'Searched customers',
  get_invoice_details: 'Retrieved invoice details',
  list_invoices: 'Listed invoices',
  list_expenses: 'Listed expenses',
  get_chart_of_accounts: 'Retrieved chart of accounts',
  get_general_ledger: 'Retrieved general ledger',
  get_trial_balance: 'Generated trial balance',
  get_profit_loss: 'Generated profit & loss statement',
  get_balance_sheet: 'Generated balance sheet',
  search_products: 'Searched products/inventory',
  list_employees: 'Listed employees',
  get_payroll_summary: 'Retrieved payroll summary',
  get_bank_accounts: 'Retrieved bank accounts',
  get_aging_report: 'Generated aging report',
  create_draft_invoice: 'Created draft invoice',
  get_pos_daily_sales: 'Retrieved POS daily sales',
};
