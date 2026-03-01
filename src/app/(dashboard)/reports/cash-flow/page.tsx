'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import {
  ArrowDownTrayIcon,
  PrinterIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { printContent, generateTable } from '@/lib/print';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CashFlowLineItem {
  label: string;
  amount: number;
  indent?: boolean;
}

interface CashFlowSection {
  title: string;
  items: CashFlowLineItem[];
  subtotal: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CashFlowPage() {
  const { fc, fcp } = useCurrency();
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const { glAccounts, journalEntries, invoices, expenses, activeCompany } =
    useAppStore();

  // -----------------------------------------------------------------------
  // Filter helpers
  // -----------------------------------------------------------------------

  const filterByDateRange = <T extends { date?: string | Date; createdAt?: string | Date }>(
    items: T[],
  ): T[] => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    return items.filter((item) => {
      const d = new Date(item.date || item.createdAt || new Date());
      return d >= start && d <= end;
    });
  };

  // -----------------------------------------------------------------------
  // Build cash-flow data (indirect method)
  // -----------------------------------------------------------------------

  const cashFlowData = useMemo(() => {
    // -- Filtered data in range --
    const filteredInvoices = filterByDateRange(invoices);
    const filteredExpenses = filterByDateRange(expenses);
    const filteredEntries = filterByDateRange(journalEntries).filter(
      (je) => je.status === 'posted',
    );

    // == OPERATING ACTIVITIES (Indirect Method) ==

    // Net income approximation: paid invoices minus expenses
    const paidRevenue = filteredInvoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.total || 0), 0);
    const totalExpenses = filteredExpenses.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0,
    );
    const netIncome = paidRevenue - totalExpenses;

    // Non-cash adjustments from journal entries on expense-type accounts
    // (e.g. depreciation, amortisation)
    const depreciationAccounts = glAccounts.filter(
      (a) =>
        a.type === 'expense' &&
        (a.name.toLowerCase().includes('depreciation') ||
          a.name.toLowerCase().includes('amortisation') ||
          a.name.toLowerCase().includes('amortization')),
    );
    const depreciationAccountIds = new Set(depreciationAccounts.map((a) => a.id));

    let depreciation = 0;
    filteredEntries.forEach((je) => {
      je.lines.forEach((line) => {
        if (depreciationAccountIds.has(line.accountId)) {
          depreciation += line.debit - line.credit;
        }
      });
    });

    // Changes in working capital
    // Accounts receivable change (income-related asset accounts)
    const arAccounts = glAccounts.filter(
      (a) =>
        a.type === 'asset' &&
        (a.name.toLowerCase().includes('receivable') ||
          a.name.toLowerCase().includes('accounts receivable')),
    );
    const arIds = new Set(arAccounts.map((a) => a.id));
    let arChange = 0;
    filteredEntries.forEach((je) => {
      je.lines.forEach((line) => {
        if (arIds.has(line.accountId)) {
          arChange += line.debit - line.credit;
        }
      });
    });

    // Accounts payable change (liability accounts)
    const apAccounts = glAccounts.filter(
      (a) =>
        a.type === 'liability' &&
        (a.name.toLowerCase().includes('payable') ||
          a.name.toLowerCase().includes('accounts payable')),
    );
    const apIds = new Set(apAccounts.map((a) => a.id));
    let apChange = 0;
    filteredEntries.forEach((je) => {
      je.lines.forEach((line) => {
        if (apIds.has(line.accountId)) {
          apChange += line.credit - line.debit;
        }
      });
    });

    // Inventory change
    const inventoryAccounts = glAccounts.filter(
      (a) =>
        a.type === 'asset' &&
        a.name.toLowerCase().includes('inventory'),
    );
    const inventoryIds = new Set(inventoryAccounts.map((a) => a.id));
    let inventoryChange = 0;
    filteredEntries.forEach((je) => {
      je.lines.forEach((line) => {
        if (inventoryIds.has(line.accountId)) {
          inventoryChange += line.debit - line.credit;
        }
      });
    });

    // Prepaid expenses change
    const prepaidAccounts = glAccounts.filter(
      (a) =>
        a.type === 'asset' &&
        a.name.toLowerCase().includes('prepaid'),
    );
    const prepaidIds = new Set(prepaidAccounts.map((a) => a.id));
    let prepaidChange = 0;
    filteredEntries.forEach((je) => {
      je.lines.forEach((line) => {
        if (prepaidIds.has(line.accountId)) {
          prepaidChange += line.debit - line.credit;
        }
      });
    });

    const operatingItems: CashFlowLineItem[] = [
      { label: 'Net Income', amount: netIncome },
      { label: 'Adjustments for Non-Cash Items:', amount: 0 },
      { label: 'Depreciation & Amortisation', amount: depreciation, indent: true },
      { label: 'Changes in Working Capital:', amount: 0 },
      { label: 'Decrease (Increase) in Accounts Receivable', amount: -arChange, indent: true },
      { label: 'Decrease (Increase) in Inventory', amount: -inventoryChange, indent: true },
      { label: 'Decrease (Increase) in Prepaid Expenses', amount: -prepaidChange, indent: true },
      { label: 'Increase (Decrease) in Accounts Payable', amount: apChange, indent: true },
    ];

    const operatingSubtotal =
      netIncome + depreciation - arChange - inventoryChange - prepaidChange + apChange;

    // == INVESTING ACTIVITIES ==

    // Fixed / non-current asset accounts
    const fixedAssetAccounts = glAccounts.filter(
      (a) =>
        a.type === 'asset' &&
        (a.subType === 'non_current' ||
          a.name.toLowerCase().includes('fixed asset') ||
          a.name.toLowerCase().includes('property') ||
          a.name.toLowerCase().includes('equipment') ||
          a.name.toLowerCase().includes('vehicle') ||
          a.name.toLowerCase().includes('furniture') ||
          a.name.toLowerCase().includes('building') ||
          a.name.toLowerCase().includes('land') ||
          a.name.toLowerCase().includes('machinery')),
    );
    const fixedAssetIds = new Set(fixedAssetAccounts.map((a) => a.id));

    let purchaseOfAssets = 0;
    let saleOfAssets = 0;
    filteredEntries.forEach((je) => {
      je.lines.forEach((line) => {
        if (fixedAssetIds.has(line.accountId)) {
          if (line.debit > line.credit) {
            purchaseOfAssets += line.debit - line.credit;
          } else {
            saleOfAssets += line.credit - line.debit;
          }
        }
      });
    });

    const investingItems: CashFlowLineItem[] = [
      { label: 'Purchase of Property, Plant & Equipment', amount: -purchaseOfAssets },
      { label: 'Proceeds from Sale of Assets', amount: saleOfAssets },
    ];

    const investingSubtotal = -purchaseOfAssets + saleOfAssets;

    // == FINANCING ACTIVITIES ==

    // Loan accounts (liabilities that are not payables)
    const loanAccounts = glAccounts.filter(
      (a) =>
        a.type === 'liability' &&
        !a.name.toLowerCase().includes('payable') &&
        !a.name.toLowerCase().includes('gct') &&
        !a.name.toLowerCase().includes('tax'),
    );
    const loanIds = new Set(loanAccounts.map((a) => a.id));

    let loanProceeds = 0;
    let loanRepayments = 0;
    filteredEntries.forEach((je) => {
      je.lines.forEach((line) => {
        if (loanIds.has(line.accountId)) {
          if (line.credit > line.debit) {
            loanProceeds += line.credit - line.debit;
          } else {
            loanRepayments += line.debit - line.credit;
          }
        }
      });
    });

    // Equity accounts
    const equityAccounts = glAccounts.filter((a) => a.type === 'equity');
    const equityIds = new Set(equityAccounts.map((a) => a.id));

    let equityContributions = 0;
    let dividendsPaid = 0;
    filteredEntries.forEach((je) => {
      je.lines.forEach((line) => {
        if (equityIds.has(line.accountId)) {
          if (line.credit > line.debit) {
            equityContributions += line.credit - line.debit;
          } else {
            dividendsPaid += line.debit - line.credit;
          }
        }
      });
    });

    const financingItems: CashFlowLineItem[] = [
      { label: 'Proceeds from Loans', amount: loanProceeds },
      { label: 'Repayment of Loans', amount: -loanRepayments },
      { label: 'Owner Contributions / Capital Injected', amount: equityContributions },
      { label: 'Dividends / Drawings Paid', amount: -dividendsPaid },
    ];

    const financingSubtotal =
      loanProceeds - loanRepayments + equityContributions - dividendsPaid;

    // == SUMMARY ==

    const netChange = operatingSubtotal + investingSubtotal + financingSubtotal;

    // Opening cash balance: sum of cash / bank asset accounts at start of period
    const cashAccounts = glAccounts.filter(
      (a) =>
        a.type === 'asset' &&
        (a.name.toLowerCase().includes('cash') ||
          a.name.toLowerCase().includes('bank') ||
          a.isBankAccount),
    );
    const openingCash = cashAccounts.reduce(
      (sum, a) => sum + Number(a.balance || a.currentBalance || 0),
      0,
    );
    const closingCash = openingCash + netChange;

    const sections: CashFlowSection[] = [
      {
        title: 'Cash Flows from Operating Activities',
        items: operatingItems,
        subtotal: operatingSubtotal,
      },
      {
        title: 'Cash Flows from Investing Activities',
        items: investingItems,
        subtotal: investingSubtotal,
      },
      {
        title: 'Cash Flows from Financing Activities',
        items: financingItems,
        subtotal: financingSubtotal,
      },
    ];

    return { sections, netChange, openingCash, closingCash };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glAccounts, journalEntries, invoices, expenses, dateRange]);

  // -----------------------------------------------------------------------
  // Color helper
  // -----------------------------------------------------------------------

  const amountColor = (value: number) =>
    value > 0
      ? 'text-emerald-600'
      : value < 0
        ? 'text-red-600'
        : 'text-gray-700 dark:text-gray-300';

  const formatAmount = (value: number) => {
    if (value < 0) {
      return `(${fc(Math.abs(value))})`;
    }
    return fc(value);
  };

  // -----------------------------------------------------------------------
  // Print handler
  // -----------------------------------------------------------------------

  const handlePrint = () => {
    const dateSubtitle = `For the period ${formatDate(new Date(dateRange.start))} to ${formatDate(new Date(dateRange.end))}`;

    let rows: { label: string; amount: number }[] = [];

    cashFlowData.sections.forEach((section) => {
      rows.push({ label: `**${section.title}**`, amount: NaN });
      section.items.forEach((item) => {
        if (item.amount === 0 && !item.indent) {
          rows.push({ label: item.label, amount: NaN });
        } else {
          rows.push({
            label: item.indent ? `    ${item.label}` : item.label,
            amount: item.amount,
          });
        }
      });
      rows.push({
        label: `Net Cash from ${section.title.replace('Cash Flows from ', '')}`,
        amount: section.subtotal,
      });
      rows.push({ label: '', amount: NaN });
    });

    rows.push({ label: 'Net Change in Cash', amount: cashFlowData.netChange });
    rows.push({ label: 'Opening Cash Balance', amount: cashFlowData.openingCash });
    rows.push({ label: 'Closing Cash Balance', amount: cashFlowData.closingCash });

    const content = generateTable(
      [
        { key: 'label', label: 'Description' },
        { key: 'amount', label: 'Amount (JMD)', align: 'right' },
      ],
      rows.map((r) => ({
        label: r.label,
        amount: isNaN(r.amount) ? '' : r.amount,
      })),
      {
        formatters: {
          amount: (v: number | string) => {
            if (v === '' || v === undefined || v === null) return '';
            const n = Number(v);
            const color = n > 0 ? '#059669' : n < 0 ? '#dc2626' : '#374151';
            const display =
              n < 0
                ? `(${fcp(Math.abs(n))})`
                : fcp(n);
            return `<span style="color:${color}">${display}</span>`;
          },
        },
        summaryRow: {
          label: 'Closing Cash Balance',
          amount: cashFlowData.closingCash,
        },
      },
    );

    printContent({
      title: 'Cash Flow Statement',
      subtitle: dateSubtitle,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  // -----------------------------------------------------------------------
  // Download as CSV
  // -----------------------------------------------------------------------

  const handleDownload = () => {
    const rows: { Description: string; Amount: string }[] = [];

    cashFlowData.sections.forEach((section) => {
      rows.push({ Description: section.title, Amount: '' });
      section.items.forEach((item) => {
        if (item.amount !== 0 || item.indent) {
          rows.push({
            Description: item.indent ? `  ${item.label}` : item.label,
            Amount: item.amount.toFixed(2),
          });
        } else {
          rows.push({ Description: item.label, Amount: '' });
        }
      });
      rows.push({
        Description: `Net Cash from ${section.title.replace('Cash Flows from ', '')}`,
        Amount: section.subtotal.toFixed(2),
      });
      rows.push({ Description: '', Amount: '' });
    });

    rows.push({
      Description: 'Net Change in Cash',
      Amount: cashFlowData.netChange.toFixed(2),
    });
    rows.push({
      Description: 'Opening Cash Balance',
      Amount: cashFlowData.openingCash.toFixed(2),
    });
    rows.push({
      Description: 'Closing Cash Balance',
      Amount: cashFlowData.closingCash.toFixed(2),
    });

    // Build CSV manually for proper quoting
    const csvContent = [
      'Description,Amount (JMD)',
      ...rows.map((r) => {
        const desc =
          r.Description.includes(',') || r.Description.includes('"')
            ? `"${r.Description.replace(/"/g, '""')}"`
            : r.Description;
        return `${desc},${r.Amount}`;
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-flow-statement-${dateRange.start}-to-${dateRange.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Cash Flow Statement
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Indirect method &mdash; sources and uses of cash
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Date Range Picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Period:</span>
            </div>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="w-40"
            />
            <span className="text-gray-400 dark:text-gray-500">to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="w-40"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  setDateRange({
                    start: new Date(now.getFullYear(), now.getMonth(), 1)
                      .toISOString()
                      .split('T')[0],
                    end: now.toISOString().split('T')[0],
                  });
                }}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  setDateRange({
                    start: new Date(now.getFullYear(), now.getMonth() - 3, 1)
                      .toISOString()
                      .split('T')[0],
                    end: now.toISOString().split('T')[0],
                  });
                }}
              >
                This Quarter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  setDateRange({
                    start: new Date(now.getFullYear(), 0, 1)
                      .toISOString()
                      .split('T')[0],
                    end: now.toISOString().split('T')[0],
                  });
                }}
              >
                This Year
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Sections */}
      {cashFlowData.sections.map((section, sIdx) => {
        const isOperating = sIdx === 0;
        const isInvesting = sIdx === 1;
        const sectionIcon = isOperating ? (
          <ArrowTrendingUpIcon className="w-5 h-5 text-blue-600" />
        ) : isInvesting ? (
          <ArrowTrendingDownIcon className="w-5 h-5 text-amber-600" />
        ) : (
          <ArrowTrendingUpIcon className="w-5 h-5 text-purple-600" />
        );

        return (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                {sectionIcon}
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {section.items.map((item, idx) => {
                  // Section sub-header (amount = 0, not indented)
                  const isSubHeader =
                    item.amount === 0 && !item.indent;

                  if (isSubHeader) {
                    return (
                      <div
                        key={idx}
                        className="py-3 pt-5"
                      >
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {item.label}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between py-3 ${
                        item.indent ? 'pl-6' : ''
                      }`}
                    >
                      <span
                        className={`text-sm ${
                          item.indent
                            ? 'text-gray-600 dark:text-gray-400'
                            : 'font-medium text-gray-800 dark:text-gray-100'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span
                        className={`font-mono text-sm font-medium ${amountColor(
                          item.amount,
                        )}`}
                      >
                        {formatAmount(item.amount)}
                      </span>
                    </div>
                  );
                })}

                {/* Subtotal row */}
                <div className="flex items-center justify-between py-4 bg-gray-50 dark:bg-gray-900 -mx-6 px-6 mt-2 rounded-b-lg border-t-2 border-gray-200 dark:border-gray-700">
                  <span className="font-bold text-gray-900 dark:text-white">
                    Net Cash from{' '}
                    {section.title.replace('Cash Flows from ', '')}
                  </span>
                  <span
                    className={`font-mono text-base font-bold ${amountColor(
                      section.subtotal,
                    )}`}
                  >
                    {formatAmount(section.subtotal)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Summary */}
      <Card className="border-2 border-gray-300 dark:border-gray-600">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Cash Flow Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {/* Net change */}
            <div className="flex items-center justify-between py-4">
              <span className="font-medium text-gray-800 dark:text-gray-100">
                Net Change in Cash
              </span>
              <span
                className={`font-mono text-base font-bold ${amountColor(
                  cashFlowData.netChange,
                )}`}
              >
                {formatAmount(cashFlowData.netChange)}
              </span>
            </div>

            {/* Opening balance */}
            <div className="flex items-center justify-between py-4">
              <span className="font-medium text-gray-800 dark:text-gray-100">
                Opening Cash Balance
              </span>
              <span className="font-mono text-base font-medium text-gray-700 dark:text-gray-300">
                {fc(cashFlowData.openingCash)}
              </span>
            </div>

            {/* Closing balance */}
            <div className="flex items-center justify-between py-5 bg-emerald-50 dark:bg-emerald-900/30 -mx-6 px-6 rounded-b-lg border-t-2 border-emerald-200 dark:border-emerald-800">
              <span className="font-bold text-lg text-gray-900 dark:text-white">
                Closing Cash Balance
              </span>
              <span
                className={`font-mono text-xl font-bold ${amountColor(
                  cashFlowData.closingCash,
                )}`}
              >
                {formatAmount(cashFlowData.closingCash)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer note */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Report period: {formatDate(new Date(dateRange.start))} &ndash;{' '}
        {formatDate(new Date(dateRange.end))}
        {activeCompany?.businessName
          ? ` | ${activeCompany.businessName}`
          : ''}
      </p>
    </div>
  );
}
