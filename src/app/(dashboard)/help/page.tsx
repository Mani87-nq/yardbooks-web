'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui';
import { useTour } from '@/hooks/useTour';
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  CubeIcon,
  QuestionMarkCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  BookOpenIcon,
  ChartBarIcon,
  CalculatorIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HomeIcon,
  BanknotesIcon,
  SparklesIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// FAQ Data
// ---------------------------------------------------------------------------

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  // ── Getting Started ──────────────────────────────────────────────────
  {
    category: 'Getting Started',
    question: 'How do I set up my company in YaadBooks?',
    answer:
      'After registering, you\'ll be guided through our onboarding wizard. Go to Settings to update your company details including business name, TRN, GCT number, address, and fiscal year settings. You can also access the onboarding page at any time from the dashboard.',
  },
  {
    category: 'Getting Started',
    question: 'How do I add products or services?',
    answer:
      'Navigate to Inventory and click "Add Product". Enter the product name, SKU, description, price, GCT rate, and stock quantity. You can also set reorder points, assign categories, and upload product images. For services, simply mark the item as a service type which does not track stock.',
  },
  {
    category: 'Getting Started',
    question: 'How do I create my first invoice?',
    answer:
      'Go to Invoices and click "New Invoice". Select or create a customer, add line items (products or services) with quantities and prices, set the due date, and choose to save as Draft or send directly to the customer. GCT is automatically calculated based on each line item\'s tax rate.',
  },
  {
    category: 'Getting Started',
    question: 'How do I invite team members?',
    answer:
      'Go to Settings > Team tab. Click "Invite Team Member" and enter their email address and select their role. They\'ll need to have a YaadBooks account first. Roles include Staff, Accountant, Admin, and Owner, each with different permission levels.',
  },
  {
    category: 'Getting Started',
    question: 'What subscription plans are available?',
    answer:
      'YaadBooks offers four plans: Starter (J$16.99/mo) for basic invoicing and expenses, Business (J$34.99/mo) adds payroll, recurring invoices, and advanced reports, Pro (J$69.99/mo) adds fixed assets, journal entries, and AI assistant, and Enterprise (J$149.99/mo) includes everything plus custom integrations and unlimited features. New accounts get a 14-day free trial of the Business plan.',
  },

  // ── Point of Sale ────────────────────────────────────────────────────
  {
    category: 'Point of Sale',
    question: 'How do I ring up a sale in the POS?',
    answer:
      'Open the Point of Sale page and ensure you have an active session. Search or browse products using the product grid, tap items to add them to the cart, adjust quantities as needed, then click "Charge" to process the payment. You can accept cash, card, JAM-DEX, Lynk, or split across multiple payment methods.',
  },
  {
    category: 'Point of Sale',
    question: 'How do I process a POS return?',
    answer:
      'Go to POS Returns from the sidebar. Click "New Return", search for the original transaction by receipt number or date, select the items being returned and the quantity, choose the refund method (cash, card reversal, or store credit), and process the return. The inventory is automatically restocked.',
  },
  {
    category: 'Point of Sale',
    question: 'How do I manage POS sessions?',
    answer:
      'Go to POS Sessions to view all sessions. To start a new session, open the POS and click "Open Session" entering your opening cash float amount. At the end of your shift, click "Close Session" and enter your counted cash. YaadBooks will compare expected vs actual amounts and flag any discrepancies.',
  },
  {
    category: 'Point of Sale',
    question: 'What is Day Management?',
    answer:
      'Day Management lets you open and close your business day across all POS terminals. Opening a day sets the trading date and unlocks POS access. Closing the day finalises all sessions, generates end-of-day summaries, and reconciles payments. This is especially useful for businesses with multiple terminals or shifts.',
  },
  {
    category: 'Point of Sale',
    question: 'What payment methods does POS support?',
    answer:
      'YaadBooks POS supports Cash, JAM-DEX (Jamaica\'s CBDC), Lynk Wallet, WiPay, Visa/Mastercard, other cards, bank transfer, and store credit. You can configure which methods are available per terminal in POS Grid Settings.',
  },
  {
    category: 'Point of Sale',
    question: 'Can I use POS offline?',
    answer:
      'Yes! YaadBooks works as a PWA (Progressive Web App) with offline support. Orders created while offline are automatically queued and synced when you reconnect to the internet. This ensures you never miss a sale even during connectivity issues.',
  },

  // ── Invoicing ────────────────────────────────────────────────────────
  {
    category: 'Invoicing',
    question: 'How do I create an invoice?',
    answer:
      'Go to Invoices > New Invoice. Select a customer (or create one), add line items with quantities and prices, set the due date, and save as Draft or send directly. GCT is automatically calculated based on your rate settings. You can also add notes, terms, and attach files.',
  },
  {
    category: 'Invoicing',
    question: 'How do I set up recurring invoices?',
    answer:
      'Go to Invoices > Recurring Invoices (requires Business plan). Click "New Recurring Invoice" and create a template with frequency (weekly, monthly, quarterly, yearly), start date, and optional end date. YaadBooks will automatically generate and optionally send invoices on schedule.',
  },
  {
    category: 'Invoicing',
    question: 'How do I issue a credit note?',
    answer:
      'Go to Invoices > Credit Notes (requires Business plan). Click "New Credit Note", select the original invoice, specify whether it\'s a full or partial credit, and choose the reason. YaadBooks will create the credit note and adjust the invoice balance automatically. The credit note can be applied to future invoices.',
  },
  {
    category: 'Invoicing',
    question: 'How do I send payment reminders?',
    answer:
      'Go to Invoices > Payment Reminders to view overdue invoices. You can send manual reminders to individual customers or set up automated reminder schedules. Reminders are sent via email and include a summary of the outstanding amount, invoice number, and due date.',
  },
  {
    category: 'Invoicing',
    question: 'How does GCT calculation work on invoices?',
    answer:
      'YaadBooks supports all Jamaica GCT rates: Standard (15%), Telecom (25%), Tourism (10%), Zero-Rated (0%), and Exempt. Each invoice line item can have a different GCT rate. The total GCT is automatically calculated, broken down by rate, and displayed on your invoices.',
  },

  // ── Inventory ────────────────────────────────────────────────────────
  {
    category: 'Inventory',
    question: 'How do I manage products and stock?',
    answer:
      'Go to Inventory to view all products with current stock levels. You can add new products, edit existing ones, set reorder points for low-stock alerts, and categorise items. The inventory list shows real-time quantities updated automatically from POS sales and stock adjustments.',
  },
  {
    category: 'Inventory',
    question: 'How do I perform a stock count?',
    answer:
      'In the Inventory section, select products and use the "Adjust Stock" action. Enter the actual counted quantity and YaadBooks will calculate the variance. You can add a reason for the adjustment (e.g., damage, theft, count correction). All adjustments are logged in the audit trail.',
  },
  {
    category: 'Inventory',
    question: 'How do stock transfers between warehouses work?',
    answer:
      'Go to Stock Transfers from the sidebar. Click "New Transfer", select the source warehouse, destination warehouse, and the products with quantities to transfer. Submit the transfer and it will be processed, updating stock levels at both locations. You can track transfer status and history.',
  },
  {
    category: 'Inventory',
    question: 'Can I import products in bulk?',
    answer:
      'Yes. In the Inventory section, use the import feature to upload a CSV file with your product data. YaadBooks provides a template CSV you can download, fill in with your product details (name, SKU, price, stock, GCT rate), and upload to create many products at once.',
  },

  // ── Accounting ───────────────────────────────────────────────────────
  {
    category: 'Accounting',
    question: 'How do I use the Chart of Accounts?',
    answer:
      'Go to Accounting > Chart of Accounts. YaadBooks comes with a pre-configured chart of accounts following Jamaican accounting standards. You can view, add, edit, or deactivate accounts. Accounts are organised by type: Assets, Liabilities, Equity, Revenue, and Expenses.',
  },
  {
    category: 'Accounting',
    question: 'How do I create journal entries?',
    answer:
      'Go to Accounting > Journal Entries (requires Pro plan). Click "New Journal Entry", set the date and description, then add debit and credit lines selecting the appropriate accounts. The entry must balance (total debits equal total credits) before it can be posted.',
  },
  {
    category: 'Accounting',
    question: 'How do I handle GCT/tax filing?',
    answer:
      'YaadBooks automatically tracks GCT collected on sales and GCT paid on expenses. Go to Reports to generate your GCT summary for any period. This report shows total output tax (collected), input tax (paid), and the net amount due to or refundable from TAJ. Use this data to file your GCT return.',
  },
  {
    category: 'Accounting',
    question: 'How does bank reconciliation work?',
    answer:
      'Go to Banking > Reconciliation (requires Business plan). Import your bank statement or manually enter transactions, then match them against your recorded transactions. Unmatched items can be reviewed and categorised. This ensures your books match your actual bank balance.',
  },
  {
    category: 'Accounting',
    question: 'How do I record expenses?',
    answer:
      'Go to Expenses and click "Add Expense". Enter the vendor, category, amount, GCT amount (if claimable), payment method, and date. Categories include advertising, bank fees, equipment, insurance, rent, salaries, utilities, and more. Expenses automatically create the corresponding accounting entries.',
  },

  // ── Payroll ──────────────────────────────────────────────────────────
  {
    category: 'Payroll',
    question: 'How do I add employees?',
    answer:
      'Go to Payroll (requires Business plan) and click "Add Employee". Enter their personal details, NIS number, TRN, employment type (full-time, part-time, contract), salary or hourly rate, pay frequency, and bank details for direct deposit. You can also set up allowances and deductions.',
  },
  {
    category: 'Payroll',
    question: 'How do I run payroll?',
    answer:
      'In the Payroll section, click "Run Payroll". Select the pay period, review employees included, verify hours (for hourly workers), and check any overtime or bonuses. YaadBooks automatically calculates gross pay, NIS contributions, PAYE income tax, NHT deductions, and Education Tax. Review the summary and process.',
  },
  {
    category: 'Payroll',
    question: 'What statutory deductions does YaadBooks calculate?',
    answer:
      'YaadBooks calculates all Jamaican statutory deductions: NIS (National Insurance Scheme) at 3% employee / 3% employer, NHT (National Housing Trust) at 2% employee / 3% employer, Education Tax at 2.25% employee / 3.5% employer, and PAYE income tax using current thresholds and rates set by TAJ.',
  },
  {
    category: 'Payroll',
    question: 'Can I generate payslips?',
    answer:
      'Yes. After processing a payroll run, you can generate and download individual payslips for each employee. Payslips show gross pay, all deductions broken down, net pay, and year-to-date totals. You can also email payslips directly to employees.',
  },

  // ── Reports ──────────────────────────────────────────────────────────
  {
    category: 'Reports',
    question: 'How do I generate a Trial Balance?',
    answer:
      'Go to Reports > Trial Balance. Select the date range and click "Generate". The report shows all account balances with total debits and credits. You can filter by account type, export to CSV or PDF, and compare against previous periods.',
  },
  {
    category: 'Reports',
    question: 'How do I view the General Ledger?',
    answer:
      'Go to Reports > General Ledger. Select an account and date range to see all transactions posted to that account. The report shows the opening balance, each transaction with date, description, debit/credit amounts, and the running balance.',
  },
  {
    category: 'Reports',
    question: 'What are aging reports?',
    answer:
      'Go to Reports > AR/AP Aging. Accounts Receivable aging shows how long customer invoices have been outstanding, grouped into current, 30, 60, 90, and 90+ day buckets. Accounts Payable aging shows the same for your bills. These reports help you manage cash flow and follow up on overdue payments.',
  },
  {
    category: 'Reports',
    question: 'What POS reports are available?',
    answer:
      'YaadBooks provides several POS reports: Sales Summary (total sales by period), Payment Method Breakdown (cash vs card vs digital), Product Performance (top-selling items), Session Reports (per-cashier totals), and Daily/Weekly/Monthly trend analysis. Access these from the Reports section or the POS dashboard.',
  },
  {
    category: 'Reports',
    question: 'Can I export reports?',
    answer:
      'Yes. All reports in YaadBooks can be exported to CSV for spreadsheet analysis or PDF for printing and sharing. Use the export buttons at the top of any report. You can also schedule automated report delivery via email on the Pro plan and above.',
  },
  {
    category: 'Reports',
    question: 'How does the Cash Flow report work?',
    answer:
      'Go to Reports > Cash Flow. This report shows money coming in (from invoices, POS sales) and going out (expenses, payroll) over a period. It is broken into Operating, Investing, and Financing activities following standard accounting formats, giving you a clear picture of your liquidity.',
  },

  // ── New Features ─────────────────────────────────────────────────
  {
    category: 'New Features',
    question: 'What are Pension Plans and how do I set them up?',
    answer:
      'Go to HR & Payroll > Pension Plans to manage TAJ-approved pension plans. Click "Add Pension Plan" to create a new plan with the provider name, policy number, employee contribution rate, and employer contribution rate. Mark plans as TAJ-approved to enable automatic PAYE tax relief for enrolled employees. Employee contributions to approved plans are deducted from statutory income before PAYE calculation.',
  },
  {
    category: 'New Features',
    question: 'How do Statutory Remittances work?',
    answer:
      'Go to HR & Payroll > Remittances to track PAYE, NIS, NHT, Education Tax, and HEART/NTA payments to government agencies. Click "Generate Remittances" to automatically calculate amounts due from approved payroll runs for a given month. All statutory deductions must be remitted by the 14th of the following month. The page shows payment status, amounts due vs paid, and overdue items.',
  },
  {
    category: 'New Features',
    question: 'What is the KPI Dashboard?',
    answer:
      'Go to Reports & AI > KPI Dashboard for a real-time view of your key financial metrics. This includes revenue (monthly and YTD), gross and net profit margins, cash on hand, current and quick ratios, AR/AP days, payroll as a percentage of revenue, cash runway, and MoM revenue growth. All metrics use the Jamaica fiscal year (April 1 - March 31) and are calculated from your actual GL data.',
  },
  {
    category: 'New Features',
    question: 'How do I create and use Budgets?',
    answer:
      'Go to Accounting > Budgets to create annual budgets. Click "Create Budget", enter a name, select the fiscal year, and add budget lines by choosing GL accounts and entering monthly amounts. Once created, go to Reports & AI > Budget vs Actual to compare your budgeted amounts against actual GL activity, with variance analysis showing where you are over or under budget.',
  },
  {
    category: 'New Features',
    question: 'What is the Stock Valuation Report?',
    answer:
      'Go to Reports & AI > Stock Valuation to see the total value of your inventory using the weighted average cost method. The report shows each product with its quantity, average cost, total value, retail value, and potential margin. You can filter to see only low-stock items, view a category breakdown, and export the data to CSV or print it.',
  },
  {
    category: 'New Features',
    question: 'How does Customer Profitability analysis work?',
    answer:
      'Go to Reports & AI > Customer Profitability to rank customers by gross profit contribution. Select a date range and the report shows each customer\'s revenue, COGS, gross profit, margin, revenue share, invoice count, outstanding balance, and payment rate. A Pareto insight shows what percentage of revenue comes from your top 20% of customers.',
  },
  {
    category: 'New Features',
    question: 'What is the Departmental P&L?',
    answer:
      'Go to Reports & AI > Departmental P&L to see a Profit & Loss breakdown by department. Revenue and expenses are allocated based on journal entries and employee departments (from payroll). Click on any department row to expand and see the individual account balances. This helps identify which departments are most and least profitable.',
  },
  {
    category: 'New Features',
    question: 'Can I print or export the new reports?',
    answer:
      'Yes! All new report pages include Print and Export CSV buttons. Click "Print" to open a formatted print view (which can also be saved as PDF via your browser\'s print dialog). Click "Export CSV" to download the data as a spreadsheet-compatible CSV file for further analysis in Excel or Google Sheets.',
  },
];

// ---------------------------------------------------------------------------
// Derived constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Getting Started',
  'Point of Sale',
  'Invoicing',
  'Inventory',
  'Accounting',
  'Payroll',
  'Reports',
  'New Features',
];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Getting Started': RocketLaunchIcon,
  'Point of Sale': ShoppingCartIcon,
  Invoicing: DocumentTextIcon,
  Inventory: CubeIcon,
  Accounting: BookOpenIcon,
  Payroll: UserGroupIcon,
  Reports: ChartBarIcon,
  'New Features': SparklesIcon,
};

// ---------------------------------------------------------------------------
// Quick Links
// ---------------------------------------------------------------------------

interface QuickLink {
  label: string;
  href: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    description: 'Overview of your business',
    icon: HomeIcon,
  },
  {
    label: 'Create Invoice',
    href: '/invoices',
    description: 'Bill your customers',
    icon: DocumentTextIcon,
  },
  {
    label: 'Point of Sale',
    href: '/pos',
    description: 'Ring up in-store sales',
    icon: ShoppingCartIcon,
  },
  {
    label: 'Inventory',
    href: '/inventory',
    description: 'Manage products & stock',
    icon: CubeIcon,
  },
  {
    label: 'Expenses',
    href: '/expenses',
    description: 'Track business expenses',
    icon: BanknotesIcon,
  },
  {
    label: 'Reports',
    href: '/reports',
    description: 'Financial reports & insights',
    icon: ChartBarIcon,
  },
  {
    label: 'Payroll',
    href: '/payroll',
    description: 'Run payroll for your team',
    icon: UserGroupIcon,
  },
  {
    label: 'Settings',
    href: '/settings',
    description: 'Company & account settings',
    icon: Cog6ToothIcon,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { startTour, resetTour } = useTour();
  const router = useRouter();

  // Filtered FAQ list based on search + active category
  const filteredFAQ = useMemo(() => {
    let items = FAQ_DATA;

    if (activeCategory) {
      items = items.filter((f) => f.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
      );
    }

    return items;
  }, [searchQuery, activeCategory]);

  const toggleItem = (index: number) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help Center</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Find answers to common questions about YaadBooks
        </p>
      </div>

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            // Reset open items on new search so results start collapsed
            setOpenItems(new Set());
          }}
          placeholder="Search help articles..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-200 dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* ── Category Filter Tabs ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setActiveCategory(null);
            setOpenItems(new Set());
          }}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            !activeCategory
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          )}
        >
          All
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat] ?? QuestionMarkCircleIcon;
          return (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat === activeCategory ? null : cat);
                setOpenItems(new Set());
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                cat === activeCategory
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              <Icon className="h-4 w-4" />
              {cat}
            </button>
          );
        })}
      </div>

      {/* ── FAQ Items ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filteredFAQ.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <QuestionMarkCircleIcon className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm mt-1">Try a different search term or category</p>
          </div>
        ) : (
          filteredFAQ.map((item, index) => {
            const globalIndex = FAQ_DATA.indexOf(item);
            const isOpen = openItems.has(globalIndex);
            return (
              <div
                key={`${item.category}-${globalIndex}`}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleItem(globalIndex)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-emerald-600 font-medium uppercase tracking-wide">
                      {item.category}
                    </span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                      {item.question}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0 ml-4" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0 ml-4" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-3">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Quick Links ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card
                padding="none"
                className="group h-full hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex-shrink-0 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                      {link.label}
                      <ArrowRightIcon className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{link.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Product Tour ─────────────────────────────────────────────── */}
      <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-6 border border-emerald-200 dark:border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">
              Platform Tour
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
              Take a guided tour of YaadBooks to learn where everything is.
            </p>
          </div>
          <button
            onClick={() => {
              resetTour('welcome');
              router.push('/dashboard');
              // Small delay to let navigation complete before starting tour
              setTimeout(() => startTour('welcome'), 600);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm flex-shrink-0"
          >
            <PlayIcon className="h-4 w-4" />
            Restart Tour
          </button>
        </div>
      </div>

      {/* ── Contact Support ─────────────────────────────────────────── */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Still need help?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Our support team is here to assist you with any questions.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="mailto:support@yaadbooks.com"
            className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm dark:hover:shadow-gray-900/20 transition-all"
          >
            <EnvelopeIcon className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Email Support</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">support@yaadbooks.com</p>
            </div>
          </a>
          <a
            href="tel:+18766139119"
            className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm dark:hover:shadow-gray-900/20 transition-all"
          >
            <PhoneIcon className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Phone Support</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">876-613-9119</p>
            </div>
          </a>
          <a
            href="https://wa.me/18766139119"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm dark:hover:shadow-gray-900/20 transition-all"
          >
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">WhatsApp</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Chat with us</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
