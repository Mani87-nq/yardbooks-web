'use client';

import React, { useState, useMemo } from 'react';
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
} from '@heroicons/react/24/outline';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  // Getting Started
  {
    category: 'Getting Started',
    question: 'How do I set up my company in YaadBooks?',
    answer: 'After registering, you\'ll be guided through our onboarding wizard. Go to Settings to update your company details including business name, TRN, GCT number, address, and fiscal year settings. You can also access this from the onboarding page at any time.',
  },
  {
    category: 'Getting Started',
    question: 'How do I invite team members?',
    answer: 'Go to Settings > Team tab. Click "Invite Team Member" and enter their email address and select their role. They\'ll need to have a YaadBooks account first. Roles include Staff, Accountant, Admin, and Owner, each with different permission levels.',
  },
  {
    category: 'Getting Started',
    question: 'What subscription plans are available?',
    answer: 'YaadBooks offers four plans: Starter (J$16.99/mo) for basic invoicing and expenses, Business (J$34.99/mo) adds payroll, recurring invoices, and advanced reports, Pro (J$69.99/mo) adds fixed assets, journal entries, and AI assistant, and Enterprise (J$149.99/mo) includes everything plus custom integrations and unlimited features. New accounts get a 14-day free trial of the Business plan.',
  },
  // Invoicing
  {
    category: 'Invoicing',
    question: 'How do I create an invoice?',
    answer: 'Go to Invoices > New Invoice. Select a customer (or create one), add line items with quantities and prices, set the due date, and save as Draft or send directly. GCT is automatically calculated based on your rate settings.',
  },
  {
    category: 'Invoicing',
    question: 'How does GCT calculation work?',
    answer: 'YaadBooks supports all Jamaica GCT rates: Standard (15%), Telecom (25%), Tourism (10%), Zero-Rated (0%), and Exempt. Each invoice line item can have a different GCT rate. The total GCT is automatically calculated and displayed on your invoices.',
  },
  {
    category: 'Invoicing',
    question: 'Can I set up recurring invoices?',
    answer: 'Yes! Go to Invoices > Recurring Invoices (requires Business plan). Create a template with frequency (weekly, monthly, quarterly, yearly), start date, and end date. YaadBooks will automatically generate invoices on schedule.',
  },
  {
    category: 'Invoicing',
    question: 'How do I issue a credit note?',
    answer: 'Go to Invoices > Credit Notes (requires Business plan). Select the original invoice, specify whether it\'s a full or partial credit, and YaadBooks will create the credit note and adjust the invoice balance automatically.',
  },
  // POS
  {
    category: 'Point of Sale',
    question: 'How do I set up the POS system?',
    answer: 'Go to POS > Settings to configure your business details, GCT rate, payment methods, and receipt settings. Then create a Terminal under POS with your printer and cash drawer configuration. Open a Session to start taking orders.',
  },
  {
    category: 'Point of Sale',
    question: 'What payment methods does POS support?',
    answer: 'YaadBooks POS supports Cash, JAM-DEX (Jamaica\'s CBDC), Lynk Wallet, WiPay, Visa/Mastercard, other cards, bank transfer, and store credit. You can configure which methods are available per terminal.',
  },
  {
    category: 'Point of Sale',
    question: 'Can I use POS offline?',
    answer: 'Yes! YaadBooks works as a PWA (Progressive Web App) with offline support. Orders created while offline are automatically queued and synced when you reconnect to the internet.',
  },
  // Expenses & Accounting
  {
    category: 'Expenses & Accounting',
    question: 'How do I record expenses?',
    answer: 'Go to Expenses and click "Add Expense". Enter the vendor, category, amount, GCT amount (if claimable), payment method, and date. Categories include advertising, bank fees, equipment, insurance, rent, salaries, utilities, and more.',
  },
  {
    category: 'Expenses & Accounting',
    question: 'How does bank reconciliation work?',
    answer: 'Go to Banking > Reconciliation (requires Business plan). Import your bank statement or manually enter transactions, then match them against your recorded transactions. Unmatched items can be reviewed and categorized.',
  },
  {
    category: 'Expenses & Accounting',
    question: 'What reports are available?',
    answer: 'Starter plan includes basic reports. Business plan adds Trial Balance, General Ledger, Cash Flow Statement, and AR/AP Aging reports. Pro plan adds Audit Trail and custom reports. All reports can be filtered by date range and exported.',
  },
  // Payroll
  {
    category: 'Payroll',
    question: 'How do I run payroll?',
    answer: 'Go to Payroll (requires Business plan). First add your employees with their salary details, NIS number, and tax information. Then create a payroll run, review calculations (including NIS, PAYE, NHT deductions), and process payments.',
  },
  // Fixed Assets
  {
    category: 'Fixed Assets',
    question: 'How do I track fixed assets?',
    answer: 'Go to Fixed Assets (requires Pro plan). Add assets with their purchase cost, depreciation method (straight-line or reducing balance), useful life, and salvage value. YaadBooks automatically calculates depreciation and Jamaica tax capital allowances.',
  },
  // Security
  {
    category: 'Security',
    question: 'Is my data secure?',
    answer: 'Yes. YaadBooks uses enterprise-grade security: passwords are hashed with Argon2id, data is encrypted in transit (HTTPS), JWT tokens with short expiry for API authentication, role-based access control (RBAC), account lockout after failed login attempts, and two-factor authentication (2FA) support.',
  },
  {
    category: 'Security',
    question: 'Can I export all my data?',
    answer: 'Yes. Go to Settings > Data Export. You can download all your invoices, customers, expenses, and products as CSV or JSON files. This ensures you always have access to your data.',
  },
  // Billing
  {
    category: 'Billing',
    question: 'How do I upgrade my plan?',
    answer: 'Go to Settings > Billing. Choose your desired plan and complete the checkout via Stripe. Your features will be unlocked immediately. You can upgrade or downgrade at any time.',
  },
  {
    category: 'Billing',
    question: 'What happens when my free trial ends?',
    answer: 'After your 14-day free trial, your account automatically downgrades to the Starter plan. You\'ll retain all your data, but features exclusive to higher plans will be locked until you subscribe. No charges are made without your consent.',
  },
];

const CATEGORIES = [...new Set(FAQ_DATA.map((f) => f.category))];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Getting Started': QuestionMarkCircleIcon,
  'Invoicing': DocumentTextIcon,
  'Point of Sale': ShoppingCartIcon,
  'Expenses & Accounting': CurrencyDollarIcon,
  'Payroll': UserGroupIcon,
  'Fixed Assets': CubeIcon,
  'Security': QuestionMarkCircleIcon,
  'Billing': CurrencyDollarIcon,
};

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
        <p className="text-gray-500 mt-1">Find answers to common questions about YaadBooks</p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search help articles..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !activeCategory
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat] ?? QuestionMarkCircleIcon;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                cat === activeCategory
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {cat}
            </button>
          );
        })}
      </div>

      {/* FAQ Items */}
      <div className="space-y-3">
        {filteredFAQ.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <QuestionMarkCircleIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm">Try a different search term or category</p>
          </div>
        ) : (
          filteredFAQ.map((item, index) => {
            const isOpen = openItems.has(index);
            return (
              <div
                key={`${item.category}-${index}`}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <span className="text-xs text-emerald-600 font-medium uppercase tracking-wide">
                      {item.category}
                    </span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{item.question}</p>
                  </div>
                  {isOpen ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Contact Support */}
      <div className="mt-12 bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Still need help?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="mailto:support@yaadbooks.com"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors"
          >
            <EnvelopeIcon className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Email Support</p>
              <p className="text-xs text-gray-500">support@yaadbooks.com</p>
            </div>
          </a>
          <a
            href="tel:+18767770000"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors"
          >
            <PhoneIcon className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Phone Support</p>
              <p className="text-xs text-gray-500">876-777-0000</p>
            </div>
          </a>
          <a
            href="https://wa.me/18767770000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors"
          >
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">WhatsApp</p>
              <p className="text-xs text-gray-500">Chat with us</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
