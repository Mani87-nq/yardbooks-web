'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { usePosStore } from '@/store/posStore';
import { formatJMD, formatDate } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
  ChartBarIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  UserGroupIcon,
  CubeIcon,
  CalculatorIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  BuildingLibraryIcon,
  PrinterIcon,
  ScaleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { printContent, generateTable, generateStatCards, formatPrintCurrency, downloadAsCSV } from '@/lib/print';

const REPORTS = [
  {
    id: 'sales',
    name: 'Sales Report',
    description: 'Revenue, invoices, and sales trends',
    icon: CurrencyDollarIcon,
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    id: 'pos',
    name: 'POS Report',
    description: 'Point of sale transactions and sessions',
    icon: ChartBarIcon,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'gct',
    name: 'GCT Report',
    description: 'Jamaica GCT collected and payable',
    icon: CalculatorIcon,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    id: 'expenses',
    name: 'Expense Report',
    description: 'Business expenses by category',
    icon: BanknotesIcon,
    color: 'bg-red-100 text-red-600',
  },
  {
    id: 'customers',
    name: 'Customer Report',
    description: 'Customer balances and activity',
    icon: UserGroupIcon,
    color: 'bg-orange-100 text-orange-600',
  },
  {
    id: 'inventory',
    name: 'Inventory Report',
    description: 'Stock levels and valuation',
    icon: CubeIcon,
    color: 'bg-cyan-100 text-cyan-600',
  },
  {
    id: 'profit_loss',
    name: 'Profit & Loss',
    description: 'Income statement',
    icon: DocumentTextIcon,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    id: 'balance_sheet',
    name: 'Balance Sheet',
    description: 'Assets, liabilities, and equity',
    icon: BuildingLibraryIcon,
    color: 'bg-gray-100 text-gray-600',
  },
  {
    id: 'trial_balance',
    name: 'Trial Balance',
    description: 'Debits and credits by account',
    icon: CalculatorIcon,
    color: 'bg-teal-100 text-teal-600',
  },
  {
    id: 'general_ledger',
    name: 'General Ledger',
    description: 'All transactions by account',
    icon: DocumentTextIcon,
    color: 'bg-amber-100 text-amber-600',
  },
  {
    id: 'cash_flow',
    name: 'Cash Flow',
    description: 'Cash inflows and outflows',
    icon: BanknotesIcon,
    color: 'bg-sky-100 text-sky-600',
  },
  {
    id: 'ar_aging',
    name: 'AR Aging',
    description: 'Accounts receivable aging',
    icon: UserGroupIcon,
    color: 'bg-rose-100 text-rose-600',
  },
  {
    id: 'ap_aging',
    name: 'AP Aging',
    description: 'Accounts payable aging',
    icon: BanknotesIcon,
    color: 'bg-violet-100 text-violet-600',
  },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const { invoices, expenses, customers, products, glAccounts, activeCompany } = useAppStore();
  const { orders } = usePosStore();

  const filterByDateRange = <T extends { date?: Date; createdAt?: Date }>(items: T[]): T[] => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    return items.filter(item => {
      const date = new Date(item.date || item.createdAt || new Date());
      return date >= start && date <= end;
    });
  };

  // Sales Report Data
  const salesData = () => {
    const filteredInvoices = filterByDateRange(invoices);
    const totalRevenue = filteredInvoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.total, 0);
    const totalInvoices = filteredInvoices.length;
    const paidInvoices = filteredInvoices.filter(i => i.status === 'paid').length;
    const pendingAmount = filteredInvoices
      .filter(i => i.status === 'sent' || i.status === 'overdue')
      .reduce((sum, i) => sum + i.total, 0);

    return { totalRevenue, totalInvoices, paidInvoices, pendingAmount };
  };

  // POS Report Data
  const posData = () => {
    const filteredOrders = orders.filter(o => {
      const date = new Date(o.createdAt);
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end && o.status === 'completed';
    });

    const totalSales = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = filteredOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const totalItems = filteredOrders.reduce((sum, o) => sum + o.itemCount, 0);

    return { totalSales, totalOrders, avgOrderValue, totalItems };
  };

  // GCT Report Data
  const gctData = () => {
    const filteredInvoices = filterByDateRange(invoices).filter(i => i.status === 'paid');
    const filteredOrders = orders.filter(o => {
      const date = new Date(o.createdAt);
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end && o.status === 'completed';
    });

    const invoiceGCT = filteredInvoices.reduce((sum, i) => sum + (i.gctAmount || 0), 0);
    const posGCT = filteredOrders.reduce((sum, o) => sum + (o.gctAmount || 0), 0);
    const totalGCT = invoiceGCT + posGCT;

    return { invoiceGCT, posGCT, totalGCT };
  };

  // Expense Report Data
  const expenseData = () => {
    const filteredExpenses = filterByDateRange(expenses);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const byCategory = filteredExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const categories = Object.entries(byCategory)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { totalExpenses, categories };
  };

  // Customer Report Data
  const customerData = () => {
    const withBalance = customers.filter(c => c.balance > 0);
    const totalReceivables = customers.reduce((sum, c) => sum + c.balance, 0);
    const topCustomers = [...customers]
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);

    return { withBalance: withBalance.length, totalReceivables, topCustomers };
  };

  // Inventory Report Data
  const inventoryData = () => {
    const totalItems = products.length;
    const totalValue = products.reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0);
    const lowStock = products.filter(p => p.quantity <= (p.reorderLevel || 0) && p.quantity > 0);
    const outOfStock = products.filter(p => p.quantity === 0);

    return { totalItems, totalValue, lowStock: lowStock.length, outOfStock: outOfStock.length };
  };

  // P&L Report Data — from real GL journal entries
  const { data: plApiData, isLoading: plLoading } = useQuery({
    queryKey: ['report-profit-loss', dateRange.start, dateRange.end],
    queryFn: () => api.get<any>(`/api/v1/reports/profit-loss?startDate=${dateRange.start}&endDate=${dateRange.end}`),
    enabled: selectedReport === 'profit_loss',
  });

  // Balance Sheet Data — from real GL journal entries
  const { data: bsApiData, isLoading: bsLoading } = useQuery({
    queryKey: ['report-balance-sheet', dateRange.end],
    queryFn: () => api.get<any>(`/api/v1/reports/balance-sheet?asOfDate=${dateRange.end}`),
    enabled: selectedReport === 'balance_sheet',
  });

  // Trial Balance Data
  const { data: tbApiData, isLoading: tbLoading } = useQuery({
    queryKey: ['report-trial-balance', dateRange.end],
    queryFn: () => api.get<any>(`/api/v1/reports/trial-balance?asOfDate=${dateRange.end}`),
    enabled: selectedReport === 'trial_balance',
  });

  // General Ledger Data
  const { data: glApiData, isLoading: glLoading } = useQuery({
    queryKey: ['report-general-ledger', dateRange.start, dateRange.end],
    queryFn: () => api.get<any>(`/api/v1/reports/general-ledger?startDate=${dateRange.start}&endDate=${dateRange.end}`),
    enabled: selectedReport === 'general_ledger',
  });

  // Cash Flow Statement Data
  const { data: cfApiData, isLoading: cfLoading } = useQuery({
    queryKey: ['report-cash-flow', dateRange.start, dateRange.end],
    queryFn: () => api.get<any>(`/api/v1/reports/cash-flow?startDate=${dateRange.start}&endDate=${dateRange.end}`),
    enabled: selectedReport === 'cash_flow',
  });

  // AR Aging Data
  const { data: arApiData, isLoading: arLoading } = useQuery({
    queryKey: ['report-ar-aging', dateRange.end],
    queryFn: () => api.get<any>(`/api/v1/reports/ar-aging?asOfDate=${dateRange.end}`),
    enabled: selectedReport === 'ar_aging',
  });

  // AP Aging Data
  const { data: apApiData, isLoading: apLoading } = useQuery({
    queryKey: ['report-ap-aging', dateRange.end],
    queryFn: () => api.get<any>(`/api/v1/reports/ap-aging?asOfDate=${dateRange.end}`),
    enabled: selectedReport === 'ap_aging',
  });

  const toggleAccountExpanded = (accountKey: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountKey)) {
        next.delete(accountKey);
      } else {
        next.add(accountKey);
      }
      return next;
    });
  };

  // Print handler
  const handlePrint = () => {
    if (!selectedReport) return;

    const reportInfo = REPORTS.find(r => r.id === selectedReport);
    const dateSubtitle = `${formatDate(new Date(dateRange.start))} - ${formatDate(new Date(dateRange.end))}`;
    let content = '';

    switch (selectedReport) {
      case 'sales': {
        const data = salesData();
        content = generateStatCards([
          { label: 'Total Revenue', value: formatPrintCurrency(data.totalRevenue), color: '#059669' },
          { label: 'Total Invoices', value: String(data.totalInvoices) },
          { label: 'Paid Invoices', value: String(data.paidInvoices), color: '#2563eb' },
          { label: 'Pending Amount', value: formatPrintCurrency(data.pendingAmount), color: '#ea580c' },
        ]);
        break;
      }
      case 'pos': {
        const data = posData();
        content = generateStatCards([
          { label: 'Total Sales', value: formatPrintCurrency(data.totalSales), color: '#059669' },
          { label: 'Total Orders', value: String(data.totalOrders) },
          { label: 'Avg Order Value', value: formatPrintCurrency(data.avgOrderValue), color: '#2563eb' },
          { label: 'Items Sold', value: String(data.totalItems), color: '#7c3aed' },
        ]);
        break;
      }
      case 'gct': {
        const data = gctData();
        content = generateStatCards([
          { label: 'Invoice GCT', value: formatPrintCurrency(data.invoiceGCT), color: '#7c3aed' },
          { label: 'POS GCT', value: formatPrintCurrency(data.posGCT), color: '#2563eb' },
          { label: 'Total GCT Collected', value: formatPrintCurrency(data.totalGCT), color: '#059669' },
        ]) + '<p style="margin-top:20px;color:#6b7280;font-size:14px;">GCT Rate: 15% (Standard)</p>';
        break;
      }
      case 'expenses': {
        const data = expenseData();
        content = generateStatCards([
          { label: 'Total Expenses', value: formatPrintCurrency(data.totalExpenses), color: '#dc2626' },
        ]) + generateTable(
          [
            { key: 'name', label: 'Category' },
            { key: 'amount', label: 'Amount', align: 'right' },
            { key: 'percentage', label: '% of Total', align: 'right' },
          ],
          data.categories.map(c => ({
            name: c.name,
            amount: c.amount,
            percentage: ((c.amount / data.totalExpenses) * 100).toFixed(1) + '%',
          })),
          {
            formatters: { amount: formatPrintCurrency },
            summaryRow: { name: 'Total', amount: data.totalExpenses, percentage: '100%' },
          }
        );
        break;
      }
      case 'customers': {
        const data = customerData();
        content = generateStatCards([
          { label: 'With Outstanding Balance', value: String(data.withBalance), color: '#ea580c' },
          { label: 'Total Receivables', value: formatPrintCurrency(data.totalReceivables), color: '#2563eb' },
        ]) + '<h3 style="margin:20px 0 10px;font-weight:600;">Top Customers by Balance</h3>' + generateTable(
          [
            { key: 'name', label: 'Customer' },
            { key: 'contact', label: 'Contact' },
            { key: 'balance', label: 'Balance', align: 'right' },
          ],
          data.topCustomers.map(c => ({
            name: c.name,
            contact: c.email || c.phone || '-',
            balance: c.balance,
          })),
          { formatters: { balance: formatPrintCurrency } }
        );
        break;
      }
      case 'inventory': {
        const data = inventoryData();
        content = generateStatCards([
          { label: 'Total Items', value: String(data.totalItems) },
          { label: 'Total Value', value: formatPrintCurrency(data.totalValue), color: '#059669' },
          { label: 'Low Stock', value: String(data.lowStock), color: '#ea580c' },
          { label: 'Out of Stock', value: String(data.outOfStock), color: '#dc2626' },
        ]);
        break;
      }
      case 'profit_loss': {
        const sections = plApiData?.sections;
        if (sections) {
          const rows: any[] = [];
          if (sections.revenue?.accounts) {
            rows.push({ label: 'REVENUE', amount: null });
            sections.revenue.accounts.forEach((a: any) => rows.push({ label: `  ${a.accountNumber} — ${a.name}`, amount: a.balance }));
            rows.push({ label: 'Total Revenue', amount: sections.revenue.total });
          }
          if (sections.operatingExpenses?.accounts) {
            rows.push({ label: 'OPERATING EXPENSES', amount: null });
            sections.operatingExpenses.accounts.forEach((a: any) => rows.push({ label: `  ${a.accountNumber} — ${a.name}`, amount: a.balance }));
            rows.push({ label: 'Total Operating Expenses', amount: sections.operatingExpenses.total });
          }
          rows.push({ label: 'NET INCOME', amount: sections.netIncome?.total || 0 });

          content = '<h3 style="margin-bottom:20px;font-weight:600;">Income Statement (Profit & Loss)</h3>' + generateTable(
            [
              { key: 'label', label: 'Description' },
              { key: 'amount', label: 'Amount', align: 'right' },
            ],
            rows.filter((r: any) => r.amount !== null),
            {
              formatters: {
                amount: (v: number) => `<span style="color:${v >= 0 ? '#059669' : '#dc2626'}">${formatPrintCurrency(Math.abs(v))}</span>`
              },
            }
          );
        }
        break;
      }
      case 'balance_sheet': {
        const bsSections = bsApiData?.sections;
        if (bsSections) {
          const rows: any[] = [];
          if (bsSections.assets?.current?.accounts) {
            rows.push({ label: 'CURRENT ASSETS', amount: null });
            bsSections.assets.current.accounts.forEach((a: any) => rows.push({ label: `  ${a.accountNumber} — ${a.name}`, amount: a.balance }));
          }
          rows.push({ label: 'Total Assets', amount: bsSections.assets?.totalAssets || 0 });
          if (bsSections.liabilities?.current?.accounts) {
            rows.push({ label: 'CURRENT LIABILITIES', amount: null });
            bsSections.liabilities.current.accounts.forEach((a: any) => rows.push({ label: `  ${a.accountNumber} — ${a.name}`, amount: a.balance }));
          }
          rows.push({ label: 'Total Liabilities', amount: bsSections.liabilities?.totalLiabilities || 0 });
          rows.push({ label: 'Total Equity', amount: bsSections.equity?.totalEquity || 0 });

          content = '<h3 style="margin-bottom:20px;font-weight:600;">Balance Sheet</h3>' + generateTable(
            [
              { key: 'label', label: 'Category' },
              { key: 'amount', label: 'Amount', align: 'right' },
            ],
            rows.filter((r: any) => r.amount !== null),
            {
              formatters: { amount: formatPrintCurrency },
              summaryRow: { label: 'Total Liabilities & Equity', amount: bsSections.totalLiabilitiesAndEquity || 0 },
            }
          );
        }
        break;
      }
      case 'trial_balance': {
        const tbData = tbApiData;
        if (tbData?.grouped) {
          const rows: any[] = [];
          const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
          typeOrder.forEach(type => {
            const group = tbData.grouped[type];
            if (group?.accounts?.length > 0) {
              rows.push({ label: type, debit: null, credit: null });
              group.accounts.forEach((a: any) => rows.push({
                label: `  ${a.accountNumber} — ${a.accountName}`,
                debit: a.debitBalance,
                credit: a.creditBalance,
              }));
              rows.push({ label: `Total ${type}`, debit: group.totalDebits, credit: group.totalCredits });
            }
          });

          content = '<h3 style="margin-bottom:20px;font-weight:600;">Trial Balance</h3>' +
            (tbData.totals?.isBalanced
              ? '<p style="color:#059669;font-weight:600;margin-bottom:16px;">&#10003; Trial Balance is balanced</p>'
              : '<p style="color:#dc2626;font-weight:600;margin-bottom:16px;">&#10007; Trial Balance is NOT balanced</p>'
            ) +
            generateTable(
              [
                { key: 'label', label: 'Account' },
                { key: 'debit', label: 'Debit', align: 'right' },
                { key: 'credit', label: 'Credit', align: 'right' },
              ],
              rows.filter((r: any) => r.debit !== null),
              {
                formatters: { debit: formatPrintCurrency, credit: formatPrintCurrency },
                summaryRow: {
                  label: 'Grand Total',
                  debit: tbData.totals?.totalDebits || 0,
                  credit: tbData.totals?.totalCredits || 0,
                },
              }
            );
        }
        break;
      }
      case 'general_ledger': {
        const glData = glApiData;
        if (glData?.accounts?.length > 0) {
          let tableHtml = '<h3 style="margin-bottom:20px;font-weight:600;">General Ledger</h3>';
          glData.accounts.forEach((acct: any) => {
            tableHtml += `<h4 style="margin-top:24px;margin-bottom:8px;font-weight:600;">${acct.accountNumber} — ${acct.accountName} (${acct.accountType})</h4>`;
            tableHtml += `<p style="font-size:13px;color:#6b7280;">Opening Balance: ${formatPrintCurrency(acct.openingBalance)} | Closing Balance: ${formatPrintCurrency(acct.closingBalance)}</p>`;
            if (acct.transactions?.length > 0) {
              tableHtml += generateTable(
                [
                  { key: 'date', label: 'Date' },
                  { key: 'entryNumber', label: 'Entry #' },
                  { key: 'description', label: 'Description' },
                  { key: 'debit', label: 'Debit', align: 'right' },
                  { key: 'credit', label: 'Credit', align: 'right' },
                  { key: 'balance', label: 'Balance', align: 'right' },
                ],
                acct.transactions.map((t: any) => ({
                  date: t.date,
                  entryNumber: t.entryNumber || '-',
                  description: t.description || '-',
                  debit: t.debit,
                  credit: t.credit,
                  balance: t.balance,
                })),
                { formatters: { debit: formatPrintCurrency, credit: formatPrintCurrency, balance: formatPrintCurrency } }
              );
            }
          });
          content = tableHtml;
        }
        break;
      }
      case 'cash_flow': {
        const cfData = cfApiData;
        if (cfData) {
          const rows: any[] = [];

          // Operating
          rows.push({ label: 'OPERATING ACTIVITIES', amount: null });
          if (cfData.operating?.netIncome !== undefined) {
            rows.push({ label: '  Net Income', amount: cfData.operating.netIncome });
          }
          cfData.operating?.adjustments?.forEach((adj: any) => {
            rows.push({ label: `  ${adj.description}`, amount: adj.amount });
          });
          rows.push({ label: 'Net Cash from Operations', amount: cfData.operating?.total || 0 });

          // Investing
          rows.push({ label: 'INVESTING ACTIVITIES', amount: null });
          cfData.investing?.items?.forEach((item: any) => {
            rows.push({ label: `  ${item.description}`, amount: item.amount });
          });
          rows.push({ label: 'Net Cash from Investing', amount: cfData.investing?.total || 0 });

          // Financing
          rows.push({ label: 'FINANCING ACTIVITIES', amount: null });
          cfData.financing?.items?.forEach((item: any) => {
            rows.push({ label: `  ${item.description}`, amount: item.amount });
          });
          rows.push({ label: 'Net Cash from Financing', amount: cfData.financing?.total || 0 });

          // Summary
          rows.push({ label: 'Net Cash Change', amount: cfData.summary?.netCashChange || 0 });
          rows.push({ label: 'Opening Cash', amount: cfData.summary?.openingCash || 0 });
          rows.push({ label: 'Closing Cash', amount: cfData.summary?.closingCash || 0 });

          content = '<h3 style="margin-bottom:20px;font-weight:600;">Cash Flow Statement</h3>' + generateTable(
            [
              { key: 'label', label: 'Description' },
              { key: 'amount', label: 'Amount', align: 'right' },
            ],
            rows.filter((r: any) => r.amount !== null),
            {
              formatters: {
                amount: (v: number) => `<span style="color:${v >= 0 ? '#059669' : '#dc2626'}">${formatPrintCurrency(Math.abs(v))}</span>`
              },
            }
          );
        }
        break;
      }
      case 'ar_aging': {
        const arData = arApiData;
        if (arData) {
          content = generateStatCards([
            { label: 'Current', value: formatPrintCurrency(arData.totals?.current || 0), color: '#059669' },
            { label: '1-30 Days', value: formatPrintCurrency(arData.totals?.days1to30 || 0), color: '#ea580c' },
            { label: '31-60 Days', value: formatPrintCurrency(arData.totals?.days31to60 || 0), color: '#dc2626' },
            { label: '61-90 Days', value: formatPrintCurrency(arData.totals?.days61to90 || 0), color: '#b91c1c' },
            { label: '90+ Days', value: formatPrintCurrency(arData.totals?.days90plus || 0), color: '#7f1d1d' },
            { label: 'Total', value: formatPrintCurrency(arData.totals?.total || 0) },
          ]) + generateTable(
            [
              { key: 'customerName', label: 'Customer' },
              { key: 'current', label: 'Current', align: 'right' },
              { key: 'days1to30', label: '1-30', align: 'right' },
              { key: 'days31to60', label: '31-60', align: 'right' },
              { key: 'days61to90', label: '61-90', align: 'right' },
              { key: 'days90plus', label: '90+', align: 'right' },
              { key: 'total', label: 'Total', align: 'right' },
            ],
            arData.customers || [],
            {
              formatters: {
                current: formatPrintCurrency,
                days1to30: formatPrintCurrency,
                days31to60: formatPrintCurrency,
                days61to90: formatPrintCurrency,
                days90plus: formatPrintCurrency,
                total: formatPrintCurrency,
              },
              summaryRow: {
                customerName: 'Total',
                current: arData.totals?.current || 0,
                days1to30: arData.totals?.days1to30 || 0,
                days31to60: arData.totals?.days31to60 || 0,
                days61to90: arData.totals?.days61to90 || 0,
                days90plus: arData.totals?.days90plus || 0,
                total: arData.totals?.total || 0,
              },
            }
          );
        }
        break;
      }
      case 'ap_aging': {
        const apData = apApiData;
        if (apData) {
          content = generateStatCards([
            { label: 'Current', value: formatPrintCurrency(apData.totals?.current || 0), color: '#059669' },
            { label: '1-30 Days', value: formatPrintCurrency(apData.totals?.days1to30 || 0), color: '#ea580c' },
            { label: '31-60 Days', value: formatPrintCurrency(apData.totals?.days31to60 || 0), color: '#dc2626' },
            { label: '61-90 Days', value: formatPrintCurrency(apData.totals?.days61to90 || 0), color: '#b91c1c' },
            { label: '90+ Days', value: formatPrintCurrency(apData.totals?.days90plus || 0), color: '#7f1d1d' },
            { label: 'Total', value: formatPrintCurrency(apData.totals?.total || 0) },
          ]) + generateTable(
            [
              { key: 'vendorName', label: 'Vendor' },
              { key: 'current', label: 'Current', align: 'right' },
              { key: 'days1to30', label: '1-30', align: 'right' },
              { key: 'days31to60', label: '31-60', align: 'right' },
              { key: 'days61to90', label: '61-90', align: 'right' },
              { key: 'days90plus', label: '90+', align: 'right' },
              { key: 'total', label: 'Total', align: 'right' },
            ],
            apData.vendors || [],
            {
              formatters: {
                current: formatPrintCurrency,
                days1to30: formatPrintCurrency,
                days31to60: formatPrintCurrency,
                days61to90: formatPrintCurrency,
                days90plus: formatPrintCurrency,
                total: formatPrintCurrency,
              },
              summaryRow: {
                vendorName: 'Total',
                current: apData.totals?.current || 0,
                days1to30: apData.totals?.days1to30 || 0,
                days31to60: apData.totals?.days31to60 || 0,
                days61to90: apData.totals?.days61to90 || 0,
                days90plus: apData.totals?.days90plus || 0,
                total: apData.totals?.total || 0,
              },
            }
          );
        }
        break;
      }
    }

    printContent({
      title: reportInfo?.name || 'Report',
      subtitle: dateSubtitle,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  // Download handler (exports as CSV where applicable)
  const handleDownload = () => {
    if (!selectedReport) return;

    const reportInfo = REPORTS.find(r => r.id === selectedReport);
    const filename = `${reportInfo?.name?.toLowerCase().replace(/\s+/g, '-') || 'report'}-${dateRange.start}-to-${dateRange.end}`;

    switch (selectedReport) {
      case 'expenses': {
        const data = expenseData();
        downloadAsCSV(
          data.categories.map(c => ({
            Category: c.name,
            Amount: c.amount,
            Percentage: ((c.amount / data.totalExpenses) * 100).toFixed(1) + '%',
          })),
          filename
        );
        break;
      }
      case 'customers': {
        const data = customerData();
        downloadAsCSV(
          data.topCustomers.map(c => ({
            Name: c.name,
            Email: c.email || '',
            Phone: c.phone || '',
            Balance: c.balance,
          })),
          filename
        );
        break;
      }
      case 'inventory': {
        downloadAsCSV(
          products.map(p => ({
            SKU: p.sku || '',
            Name: p.name,
            Category: p.category || '',
            Quantity: p.quantity,
            'Unit Price': p.unitPrice,
            'Total Value': p.unitPrice * p.quantity,
            'Reorder Level': p.reorderLevel || 0,
          })),
          filename
        );
        break;
      }
      case 'trial_balance': {
        const tbData = tbApiData;
        if (tbData?.accounts?.length > 0) {
          downloadAsCSV(
            tbData.accounts.map((a: any) => ({
              'Account Number': a.accountNumber,
              'Account Name': a.accountName,
              'Account Type': a.accountType,
              'Debit Balance': a.debitBalance,
              'Credit Balance': a.creditBalance,
            })),
            filename
          );
        } else {
          handlePrint();
        }
        break;
      }
      case 'general_ledger': {
        const glData = glApiData;
        if (glData?.accounts?.length > 0) {
          const rows: any[] = [];
          glData.accounts.forEach((acct: any) => {
            acct.transactions?.forEach((t: any) => {
              rows.push({
                'Account Number': acct.accountNumber,
                'Account Name': acct.accountName,
                'Account Type': acct.accountType,
                'Date': t.date,
                'Entry #': t.entryNumber || '',
                'Description': t.description || '',
                'Reference': t.reference || '',
                'Debit': t.debit,
                'Credit': t.credit,
                'Balance': t.balance,
              });
            });
          });
          downloadAsCSV(rows, filename);
        } else {
          handlePrint();
        }
        break;
      }
      case 'ar_aging': {
        const arData = arApiData;
        if (arData?.customers?.length > 0) {
          downloadAsCSV(
            arData.customers.map((c: any) => ({
              'Customer': c.customerName,
              'Current': c.current,
              '1-30 Days': c.days1to30,
              '31-60 Days': c.days31to60,
              '61-90 Days': c.days61to90,
              '90+ Days': c.days90plus,
              'Total': c.total,
            })),
            filename
          );
        } else {
          handlePrint();
        }
        break;
      }
      case 'ap_aging': {
        const apData = apApiData;
        if (apData?.vendors?.length > 0) {
          downloadAsCSV(
            apData.vendors.map((v: any) => ({
              'Vendor': v.vendorName,
              'Current': v.current,
              '1-30 Days': v.days1to30,
              '31-60 Days': v.days31to60,
              '61-90 Days': v.days61to90,
              '90+ Days': v.days90plus,
              'Total': v.total,
            })),
            filename
          );
        } else {
          handlePrint();
        }
        break;
      }
      default:
        // For other reports, trigger print which can be saved as PDF
        handlePrint();
    }
  };

  const renderReportContent = () => {
    switch (selectedReport) {
      case 'sales': {
        const data = salesData();
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatJMD(data.totalRevenue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total Invoices</p>
                  <p className="text-2xl font-bold text-gray-900">{data.totalInvoices}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Paid Invoices</p>
                  <p className="text-2xl font-bold text-blue-600">{data.paidInvoices}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Pending Amount</p>
                  <p className="text-2xl font-bold text-orange-600">{formatJMD(data.pendingAmount)}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      }

      case 'pos': {
        const data = posData();
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatJMD(data.totalSales)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{data.totalOrders}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Avg Order Value</p>
                  <p className="text-2xl font-bold text-blue-600">{formatJMD(data.avgOrderValue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Items Sold</p>
                  <p className="text-2xl font-bold text-purple-600">{data.totalItems}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      }

      case 'gct': {
        const data = gctData();
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Invoice GCT</p>
                  <p className="text-2xl font-bold text-purple-600">{formatJMD(data.invoiceGCT)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">POS GCT</p>
                  <p className="text-2xl font-bold text-blue-600">{formatJMD(data.posGCT)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total GCT Collected</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatJMD(data.totalGCT)}</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 mb-2">GCT Rate: 15% (Standard)</p>
                <p className="text-xs text-gray-400">
                  Report period: {formatDate(new Date(dateRange.start))} - {formatDate(new Date(dateRange.end))}
                </p>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'expenses': {
        const data = expenseData();
        return (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">{formatJMD(data.totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.categories.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between">
                      <span className="text-gray-700">{cat.name}</span>
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-red-600 h-2 rounded-full"
                            style={{ width: `${(cat.amount / data.totalExpenses) * 100}%` }}
                          />
                        </div>
                        <span className="font-medium w-24 text-right">{formatJMD(cat.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'customers': {
        const data = customerData();
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">With Outstanding Balance</p>
                  <p className="text-2xl font-bold text-orange-600">{data.withBalance}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total Receivables</p>
                  <p className="text-2xl font-bold text-blue-600">{formatJMD(data.totalReceivables)}</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Top Customers by Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topCustomers.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.email || customer.phone}</p>
                      </div>
                      <span className="font-medium text-orange-600">{formatJMD(customer.balance)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'inventory': {
        const data = inventoryData();
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900">{data.totalItems}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatJMD(data.totalValue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Low Stock</p>
                  <p className="text-2xl font-bold text-orange-600">{data.lowStock}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">{data.outOfStock}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      }

      case 'profit_loss': {
        if (plLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <ArrowDownTrayIcon className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Loading Profit & Loss report...</span>
            </div>
          );
        }

        const sections = plApiData?.sections;
        if (!sections) {
          return (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No financial data available for this period. Create invoices and expenses to see your P&L report.
              </CardContent>
            </Card>
          );
        }

        const renderAccountRows = (accounts: any[]) =>
          accounts?.map((a: any) => (
            <div key={a.accountNumber} className="flex justify-between py-1.5 pl-6">
              <span className="text-sm text-gray-600">{a.accountNumber} — {a.name}</span>
              <span className="text-sm font-medium">{formatJMD(a.balance)}</span>
            </div>
          ));

        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Income Statement (Profit & Loss)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {/* Revenue */}
                  <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide pt-2">Revenue</h3>
                  {renderAccountRows(sections.revenue?.accounts)}
                  <div className="flex justify-between py-2 border-t border-gray-200 font-semibold text-emerald-600">
                    <span>Total Revenue</span>
                    <span>{formatJMD(sections.revenue?.total || 0)}</span>
                  </div>

                  {/* COGS */}
                  {sections.costOfGoodsSold?.accounts?.length > 0 && (
                    <>
                      <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide pt-4">Cost of Goods Sold</h3>
                      {renderAccountRows(sections.costOfGoodsSold?.accounts)}
                      <div className="flex justify-between py-2 border-t border-gray-200 font-semibold text-red-600">
                        <span>Total COGS</span>
                        <span>{formatJMD(sections.costOfGoodsSold?.total || 0)}</span>
                      </div>
                    </>
                  )}

                  {/* Gross Profit */}
                  <div className="flex justify-between py-3 bg-emerald-50 -mx-4 px-4 rounded-lg font-bold mt-2">
                    <span>Gross Profit</span>
                    <span className="text-emerald-700">{formatJMD(sections.grossProfit?.total || 0)}</span>
                  </div>

                  {/* Operating Expenses */}
                  <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide pt-4">Operating Expenses</h3>
                  {renderAccountRows(sections.operatingExpenses?.accounts)}
                  <div className="flex justify-between py-2 border-t border-gray-200 font-semibold text-red-600">
                    <span>Total Operating Expenses</span>
                    <span>{formatJMD(sections.operatingExpenses?.total || 0)}</span>
                  </div>

                  {/* Operating Income */}
                  <div className="flex justify-between py-3 bg-blue-50 -mx-4 px-4 rounded-lg font-bold mt-2">
                    <span>Operating Income</span>
                    <span className={sections.operatingIncome?.total >= 0 ? 'text-blue-700' : 'text-red-600'}>
                      {formatJMD(sections.operatingIncome?.total || 0)}
                    </span>
                  </div>

                  {/* Other Expenses */}
                  {sections.otherExpenses?.accounts?.length > 0 && (
                    <>
                      <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide pt-4">Other Expenses</h3>
                      {renderAccountRows(sections.otherExpenses?.accounts)}
                      <div className="flex justify-between py-2 border-t border-gray-200 font-semibold text-orange-600">
                        <span>Total Other Expenses</span>
                        <span>{formatJMD(sections.otherExpenses?.total || 0)}</span>
                      </div>
                    </>
                  )}

                  {/* Net Income */}
                  <div className="flex justify-between py-4 bg-gray-100 -mx-4 px-4 rounded-lg font-bold text-lg mt-4">
                    <span>Net Income</span>
                    <span className={sections.netIncome?.total >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {formatJMD(sections.netIncome?.total || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'balance_sheet': {
        if (bsLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <ArrowDownTrayIcon className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Loading Balance Sheet...</span>
            </div>
          );
        }

        const bsSections = bsApiData?.sections;
        if (!bsSections) {
          return (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No financial data available. Create transactions to see your Balance Sheet.
              </CardContent>
            </Card>
          );
        }

        const renderBsAccounts = (accounts: any[]) =>
          accounts?.map((a: any) => (
            <div key={a.accountNumber} className="flex justify-between py-1.5 pl-6">
              <span className="text-sm text-gray-600">{a.accountNumber} — {a.name}</span>
              <span className="text-sm font-medium">{formatJMD(a.balance)}</span>
            </div>
          ));

        const balanceCheck = bsApiData?.balanceCheck;

        return (
          <div className="space-y-4">
            {/* Balance Check Indicator */}
            {balanceCheck && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                balanceCheck.isBalanced
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {balanceCheck.isBalanced
                  ? '✓ Balance Sheet is balanced — Assets equal Liabilities + Equity'
                  : `✗ Balance Sheet is out of balance — Difference: ${formatJMD(Math.abs(balanceCheck.totalAssets - balanceCheck.totalLiabilitiesAndEquity))}`
                }
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Balance Sheet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {/* Assets */}
                  <h3 className="font-semibold text-blue-700 text-sm uppercase tracking-wide pt-2">Assets</h3>

                  {bsSections.assets?.current?.accounts?.length > 0 && (
                    <>
                      <h4 className="text-xs font-medium text-gray-500 uppercase pl-3 pt-2">Current Assets</h4>
                      {renderBsAccounts(bsSections.assets.current.accounts)}
                      <div className="flex justify-between py-1.5 pl-3 text-sm font-semibold text-gray-700 border-t border-gray-100">
                        <span>Total Current Assets</span>
                        <span>{formatJMD(bsSections.assets.current.total || 0)}</span>
                      </div>
                    </>
                  )}

                  {bsSections.assets?.nonCurrent?.accounts?.length > 0 && (
                    <>
                      <h4 className="text-xs font-medium text-gray-500 uppercase pl-3 pt-2">Non-Current Assets</h4>
                      {renderBsAccounts(bsSections.assets.nonCurrent.accounts)}
                      <div className="flex justify-between py-1.5 pl-3 text-sm font-semibold text-gray-700 border-t border-gray-100">
                        <span>Total Non-Current Assets</span>
                        <span>{formatJMD(bsSections.assets.nonCurrent.total || 0)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between py-3 bg-blue-50 -mx-4 px-4 rounded-lg font-bold mt-2">
                    <span>Total Assets</span>
                    <span className="text-blue-700">{formatJMD(bsSections.assets?.totalAssets || 0)}</span>
                  </div>

                  {/* Liabilities */}
                  <h3 className="font-semibold text-red-700 text-sm uppercase tracking-wide pt-4">Liabilities</h3>

                  {bsSections.liabilities?.current?.accounts?.length > 0 && (
                    <>
                      <h4 className="text-xs font-medium text-gray-500 uppercase pl-3 pt-2">Current Liabilities</h4>
                      {renderBsAccounts(bsSections.liabilities.current.accounts)}
                      <div className="flex justify-between py-1.5 pl-3 text-sm font-semibold text-gray-700 border-t border-gray-100">
                        <span>Total Current Liabilities</span>
                        <span>{formatJMD(bsSections.liabilities.current.total || 0)}</span>
                      </div>
                    </>
                  )}

                  {bsSections.liabilities?.nonCurrent?.accounts?.length > 0 && (
                    <>
                      <h4 className="text-xs font-medium text-gray-500 uppercase pl-3 pt-2">Non-Current Liabilities</h4>
                      {renderBsAccounts(bsSections.liabilities.nonCurrent.accounts)}
                      <div className="flex justify-between py-1.5 pl-3 text-sm font-semibold text-gray-700 border-t border-gray-100">
                        <span>Total Non-Current Liabilities</span>
                        <span>{formatJMD(bsSections.liabilities.nonCurrent.total || 0)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between py-3 bg-red-50 -mx-4 px-4 rounded-lg font-bold mt-2">
                    <span>Total Liabilities</span>
                    <span className="text-red-700">{formatJMD(bsSections.liabilities?.totalLiabilities || 0)}</span>
                  </div>

                  {/* Equity */}
                  <h3 className="font-semibold text-purple-700 text-sm uppercase tracking-wide pt-4">Equity</h3>
                  {renderBsAccounts(bsSections.equity?.accounts)}
                  {bsSections.equity?.retainedEarnings !== undefined && bsSections.equity.retainedEarnings !== 0 && (
                    <div className="flex justify-between py-1.5 pl-6">
                      <span className="text-sm text-gray-600 italic">Retained Earnings (Current Period)</span>
                      <span className="text-sm font-medium">{formatJMD(bsSections.equity.retainedEarnings)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 bg-purple-50 -mx-4 px-4 rounded-lg font-bold mt-2">
                    <span>Total Equity</span>
                    <span className="text-purple-700">{formatJMD(bsSections.equity?.totalEquity || 0)}</span>
                  </div>

                  {/* Total L&E */}
                  <div className="flex justify-between py-4 bg-gray-100 -mx-4 px-4 rounded-lg font-bold text-lg mt-4">
                    <span>Total Liabilities & Equity</span>
                    <span className="text-gray-900">{formatJMD(bsSections.totalLiabilitiesAndEquity || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'trial_balance': {
        if (tbLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <ArrowDownTrayIcon className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Loading Trial Balance...</span>
            </div>
          );
        }

        const tbData = tbApiData;
        if (!tbData?.grouped) {
          return (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No financial data available. Create transactions to see your Trial Balance.
              </CardContent>
            </Card>
          );
        }

        const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
        const typeColors: Record<string, string> = {
          ASSET: 'text-blue-700',
          LIABILITY: 'text-red-700',
          EQUITY: 'text-purple-700',
          INCOME: 'text-emerald-700',
          EXPENSE: 'text-orange-700',
        };

        return (
          <div className="space-y-4">
            {/* Balance Indicator */}
            {tbData.totals && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                tbData.totals.isBalanced
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {tbData.totals.isBalanced
                  ? '✓ Trial Balance is balanced — Total Debits equal Total Credits'
                  : `✗ Trial Balance is NOT balanced — Debits: ${formatJMD(tbData.totals.totalDebits)}, Credits: ${formatJMD(tbData.totals.totalCredits)}`
                }
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Trial Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {/* Table Header */}
                  <div className="flex justify-between py-2 border-b-2 border-gray-300 font-semibold text-sm text-gray-700">
                    <span className="flex-1">Account</span>
                    <span className="w-32 text-right">Debit</span>
                    <span className="w-32 text-right">Credit</span>
                  </div>

                  {typeOrder.map(type => {
                    const group = tbData.grouped[type];
                    if (!group?.accounts?.length) return null;

                    return (
                      <div key={type}>
                        <h3 className={`font-semibold text-sm uppercase tracking-wide pt-4 pb-1 ${typeColors[type] || 'text-gray-700'}`}>
                          {type}
                        </h3>
                        {group.accounts.map((a: any) => (
                          <div key={a.accountNumber} className="flex justify-between py-1.5 pl-4">
                            <span className="text-sm text-gray-600 flex-1">{a.accountNumber} — {a.accountName}</span>
                            <span className="text-sm font-medium w-32 text-right">
                              {a.debitBalance > 0 ? formatJMD(a.debitBalance) : '-'}
                            </span>
                            <span className="text-sm font-medium w-32 text-right">
                              {a.creditBalance > 0 ? formatJMD(a.creditBalance) : '-'}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between py-1.5 pl-4 border-t border-gray-100 font-semibold text-sm">
                          <span className="flex-1">Total {type}</span>
                          <span className="w-32 text-right">{formatJMD(group.totalDebits)}</span>
                          <span className="w-32 text-right">{formatJMD(group.totalCredits)}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Grand Total */}
                  <div className="flex justify-between py-4 bg-gray-100 -mx-4 px-4 rounded-lg font-bold text-lg mt-4">
                    <span className="flex-1">Grand Total</span>
                    <span className="w-32 text-right">{formatJMD(tbData.totals?.totalDebits || 0)}</span>
                    <span className="w-32 text-right">{formatJMD(tbData.totals?.totalCredits || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'general_ledger': {
        if (glLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <ArrowDownTrayIcon className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Loading General Ledger...</span>
            </div>
          );
        }

        const glData = glApiData;
        if (!glData?.accounts?.length) {
          return (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No transactions found for this period. Create journal entries to see the General Ledger.
              </CardContent>
            </Card>
          );
        }

        return (
          <div className="space-y-2">
            <Card>
              <CardHeader>
                <CardTitle>General Ledger</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  {glData.accounts.length} account{glData.accounts.length !== 1 ? 's' : ''} with activity. Click an account to expand transactions.
                </p>
                <div className="space-y-1">
                  {glData.accounts.map((acct: any) => {
                    const acctKey = acct.accountNumber;
                    const isExpanded = expandedAccounts.has(acctKey);

                    return (
                      <div key={acctKey} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Account Summary Row */}
                        <button
                          onClick={() => toggleAccountExpanded(acctKey)}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            )}
                            <div>
                              <span className="font-semibold text-sm text-gray-900">{acct.accountNumber} — {acct.accountName}</span>
                              <span className="ml-2 text-xs text-gray-400">({acct.accountType})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                              <span className="text-gray-500">Debits: </span>
                              <span className="font-medium">{formatJMD(acct.periodDebits)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-gray-500">Credits: </span>
                              <span className="font-medium">{formatJMD(acct.periodCredits)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-gray-500">Balance: </span>
                              <span className="font-bold">{formatJMD(acct.closingBalance)}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {acct.transactionCount} txn{acct.transactionCount !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </button>

                        {/* Expanded Transaction Table */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 bg-gray-50 p-3">
                            <div className="flex justify-between text-xs text-gray-500 mb-2 px-2">
                              <span>Opening Balance: <strong className="text-gray-700">{formatJMD(acct.openingBalance)}</strong></span>
                              <span>Closing Balance: <strong className="text-gray-700">{formatJMD(acct.closingBalance)}</strong></span>
                            </div>
                            {acct.transactions?.length > 0 ? (
                              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-100 text-gray-600">
                                      <th className="text-left py-2 px-3 font-medium">Date</th>
                                      <th className="text-left py-2 px-3 font-medium">Entry #</th>
                                      <th className="text-left py-2 px-3 font-medium">Description</th>
                                      <th className="text-right py-2 px-3 font-medium">Debit</th>
                                      <th className="text-right py-2 px-3 font-medium">Credit</th>
                                      <th className="text-right py-2 px-3 font-medium">Balance</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {acct.transactions.map((txn: any, idx: number) => (
                                      <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                                        <td className="py-1.5 px-3 text-gray-600">{txn.date}</td>
                                        <td className="py-1.5 px-3 text-gray-600">{txn.entryNumber || '-'}</td>
                                        <td className="py-1.5 px-3 text-gray-700">{txn.description || '-'}</td>
                                        <td className="py-1.5 px-3 text-right font-medium">
                                          {txn.debit > 0 ? formatJMD(txn.debit) : '-'}
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-medium">
                                          {txn.credit > 0 ? formatJMD(txn.credit) : '-'}
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-bold">{formatJMD(txn.balance)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 text-center py-4">No transactions in this period.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'cash_flow': {
        if (cfLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <ArrowDownTrayIcon className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Loading Cash Flow Statement...</span>
            </div>
          );
        }

        const cfData = cfApiData;
        if (!cfData) {
          return (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No cash flow data available for this period.
              </CardContent>
            </Card>
          );
        }

        const renderCfItem = (description: string, amount: number) => (
          <div key={description} className="flex justify-between py-1.5 pl-6">
            <span className="text-sm text-gray-600">{description}</span>
            <span className={`text-sm font-medium ${amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {amount < 0 ? `(${formatJMD(Math.abs(amount))})` : formatJMD(amount)}
            </span>
          </div>
        );

        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Statement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {/* Operating Activities */}
                  <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide pt-2">Operating Activities</h3>
                  {cfData.operating?.netIncome !== undefined && renderCfItem('Net Income', cfData.operating.netIncome)}
                  {cfData.operating?.adjustments?.map((adj: any) => renderCfItem(adj.description, adj.amount))}
                  <div className="flex justify-between py-3 bg-blue-50 -mx-4 px-4 rounded-lg font-bold mt-2">
                    <span>Net Cash from Operations</span>
                    <span className={cfData.operating?.total >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                      {cfData.operating?.total < 0
                        ? `(${formatJMD(Math.abs(cfData.operating?.total || 0))})`
                        : formatJMD(cfData.operating?.total || 0)}
                    </span>
                  </div>

                  {/* Investing Activities */}
                  <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide pt-4">Investing Activities</h3>
                  {cfData.investing?.items?.map((item: any) => renderCfItem(item.description, item.amount))}
                  <div className="flex justify-between py-3 bg-amber-50 -mx-4 px-4 rounded-lg font-bold mt-2">
                    <span>Net Cash from Investing</span>
                    <span className={cfData.investing?.total >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                      {cfData.investing?.total < 0
                        ? `(${formatJMD(Math.abs(cfData.investing?.total || 0))})`
                        : formatJMD(cfData.investing?.total || 0)}
                    </span>
                  </div>

                  {/* Financing Activities */}
                  <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide pt-4">Financing Activities</h3>
                  {cfData.financing?.items?.map((item: any) => renderCfItem(item.description, item.amount))}
                  <div className="flex justify-between py-3 bg-purple-50 -mx-4 px-4 rounded-lg font-bold mt-2">
                    <span>Net Cash from Financing</span>
                    <span className={cfData.financing?.total >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                      {cfData.financing?.total < 0
                        ? `(${formatJMD(Math.abs(cfData.financing?.total || 0))})`
                        : formatJMD(cfData.financing?.total || 0)}
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between py-3 bg-gray-100 -mx-4 px-4 rounded-lg font-bold">
                      <span>Net Cash Change</span>
                      <span className={cfData.summary?.netCashChange >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {cfData.summary?.netCashChange < 0
                          ? `(${formatJMD(Math.abs(cfData.summary?.netCashChange || 0))})`
                          : formatJMD(cfData.summary?.netCashChange || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 px-4 -mx-4">
                      <span className="text-sm text-gray-600">Opening Cash Balance</span>
                      <span className="text-sm font-medium">{formatJMD(cfData.summary?.openingCash || 0)}</span>
                    </div>
                    <div className="flex justify-between py-4 bg-emerald-50 -mx-4 px-4 rounded-lg font-bold text-lg">
                      <span>Closing Cash Balance</span>
                      <span className="text-emerald-700">{formatJMD(cfData.summary?.closingCash || 0)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'ar_aging': {
        if (arLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <ArrowDownTrayIcon className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Loading AR Aging Report...</span>
            </div>
          );
        }

        const arData = arApiData;
        if (!arData) {
          return (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No accounts receivable data available.
              </CardContent>
            </Card>
          );
        }

        const bucketColors = [
          'bg-emerald-100 text-emerald-600',
          'bg-yellow-100 text-yellow-600',
          'bg-orange-100 text-orange-600',
          'bg-red-100 text-red-600',
          'bg-red-200 text-red-800',
          'bg-gray-100 text-gray-700',
        ];

        return (
          <div className="space-y-4">
            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {[
                { label: 'Current', value: arData.totals?.current || 0, colorIdx: 0 },
                { label: '1-30 Days', value: arData.totals?.days1to30 || 0, colorIdx: 1 },
                { label: '31-60 Days', value: arData.totals?.days31to60 || 0, colorIdx: 2 },
                { label: '61-90 Days', value: arData.totals?.days61to90 || 0, colorIdx: 3 },
                { label: '90+ Days', value: arData.totals?.days90plus || 0, colorIdx: 4 },
                { label: 'Total', value: arData.totals?.total || 0, colorIdx: 5 },
              ].map((bucket) => (
                <Card key={bucket.label}>
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">{bucket.label}</p>
                    <p className={`text-lg font-bold ${bucketColors[bucket.colorIdx].split(' ')[1]}`}>
                      {formatJMD(bucket.value)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-4 text-sm text-gray-500">
              <span>{arData.customerCount || 0} customer{(arData.customerCount || 0) !== 1 ? 's' : ''}</span>
              <span>{arData.invoiceCount || 0} invoice{(arData.invoiceCount || 0) !== 1 ? 's' : ''}</span>
            </div>

            {/* Customer Table */}
            <Card>
              <CardHeader>
                <CardTitle>Receivables by Customer</CardTitle>
              </CardHeader>
              <CardContent>
                {arData.customers?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-200 text-gray-600">
                          <th className="text-left py-2 px-3 font-semibold">Customer</th>
                          <th className="text-right py-2 px-3 font-semibold">Current</th>
                          <th className="text-right py-2 px-3 font-semibold bg-yellow-50">1-30</th>
                          <th className="text-right py-2 px-3 font-semibold bg-orange-50">31-60</th>
                          <th className="text-right py-2 px-3 font-semibold bg-red-50">61-90</th>
                          <th className="text-right py-2 px-3 font-semibold bg-red-100">90+</th>
                          <th className="text-right py-2 px-3 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arData.customers.map((c: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 font-medium text-gray-900">{c.customerName}</td>
                            <td className="py-2 px-3 text-right">{c.current > 0 ? formatJMD(c.current) : '-'}</td>
                            <td className="py-2 px-3 text-right bg-yellow-50">{c.days1to30 > 0 ? formatJMD(c.days1to30) : '-'}</td>
                            <td className="py-2 px-3 text-right bg-orange-50">{c.days31to60 > 0 ? formatJMD(c.days31to60) : '-'}</td>
                            <td className="py-2 px-3 text-right bg-red-50">{c.days61to90 > 0 ? formatJMD(c.days61to90) : '-'}</td>
                            <td className="py-2 px-3 text-right bg-red-100">{c.days90plus > 0 ? formatJMD(c.days90plus) : '-'}</td>
                            <td className="py-2 px-3 text-right font-bold">{formatJMD(c.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                          <td className="py-2 px-3">Total</td>
                          <td className="py-2 px-3 text-right">{formatJMD(arData.totals?.current || 0)}</td>
                          <td className="py-2 px-3 text-right bg-yellow-50">{formatJMD(arData.totals?.days1to30 || 0)}</td>
                          <td className="py-2 px-3 text-right bg-orange-50">{formatJMD(arData.totals?.days31to60 || 0)}</td>
                          <td className="py-2 px-3 text-right bg-red-50">{formatJMD(arData.totals?.days61to90 || 0)}</td>
                          <td className="py-2 px-3 text-right bg-red-100">{formatJMD(arData.totals?.days90plus || 0)}</td>
                          <td className="py-2 px-3 text-right">{formatJMD(arData.totals?.total || 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-6">No outstanding receivables.</p>
                )}
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'ap_aging': {
        if (apLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <ArrowDownTrayIcon className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Loading AP Aging Report...</span>
            </div>
          );
        }

        const apData = apApiData;
        if (!apData) {
          return (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No accounts payable data available.
              </CardContent>
            </Card>
          );
        }

        const apBucketColors = [
          'bg-emerald-100 text-emerald-600',
          'bg-yellow-100 text-yellow-600',
          'bg-orange-100 text-orange-600',
          'bg-red-100 text-red-600',
          'bg-red-200 text-red-800',
          'bg-gray-100 text-gray-700',
        ];

        return (
          <div className="space-y-4">
            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {[
                { label: 'Current', value: apData.totals?.current || 0, colorIdx: 0 },
                { label: '1-30 Days', value: apData.totals?.days1to30 || 0, colorIdx: 1 },
                { label: '31-60 Days', value: apData.totals?.days31to60 || 0, colorIdx: 2 },
                { label: '61-90 Days', value: apData.totals?.days61to90 || 0, colorIdx: 3 },
                { label: '90+ Days', value: apData.totals?.days90plus || 0, colorIdx: 4 },
                { label: 'Total', value: apData.totals?.total || 0, colorIdx: 5 },
              ].map((bucket) => (
                <Card key={bucket.label}>
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">{bucket.label}</p>
                    <p className={`text-lg font-bold ${apBucketColors[bucket.colorIdx].split(' ')[1]}`}>
                      {formatJMD(bucket.value)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-4 text-sm text-gray-500">
              <span>{apData.vendorCount || 0} vendor{(apData.vendorCount || 0) !== 1 ? 's' : ''}</span>
              <span>{apData.expenseCount || 0} expense{(apData.expenseCount || 0) !== 1 ? 's' : ''}</span>
            </div>

            {/* Vendor Table */}
            <Card>
              <CardHeader>
                <CardTitle>Payables by Vendor</CardTitle>
              </CardHeader>
              <CardContent>
                {apData.vendors?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-200 text-gray-600">
                          <th className="text-left py-2 px-3 font-semibold">Vendor</th>
                          <th className="text-right py-2 px-3 font-semibold">Current</th>
                          <th className="text-right py-2 px-3 font-semibold bg-yellow-50">1-30</th>
                          <th className="text-right py-2 px-3 font-semibold bg-orange-50">31-60</th>
                          <th className="text-right py-2 px-3 font-semibold bg-red-50">61-90</th>
                          <th className="text-right py-2 px-3 font-semibold bg-red-100">90+</th>
                          <th className="text-right py-2 px-3 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apData.vendors.map((v: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 font-medium text-gray-900">{v.vendorName}</td>
                            <td className="py-2 px-3 text-right">{v.current > 0 ? formatJMD(v.current) : '-'}</td>
                            <td className="py-2 px-3 text-right bg-yellow-50">{v.days1to30 > 0 ? formatJMD(v.days1to30) : '-'}</td>
                            <td className="py-2 px-3 text-right bg-orange-50">{v.days31to60 > 0 ? formatJMD(v.days31to60) : '-'}</td>
                            <td className="py-2 px-3 text-right bg-red-50">{v.days61to90 > 0 ? formatJMD(v.days61to90) : '-'}</td>
                            <td className="py-2 px-3 text-right bg-red-100">{v.days90plus > 0 ? formatJMD(v.days90plus) : '-'}</td>
                            <td className="py-2 px-3 text-right font-bold">{formatJMD(v.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                          <td className="py-2 px-3">Total</td>
                          <td className="py-2 px-3 text-right">{formatJMD(apData.totals?.current || 0)}</td>
                          <td className="py-2 px-3 text-right bg-yellow-50">{formatJMD(apData.totals?.days1to30 || 0)}</td>
                          <td className="py-2 px-3 text-right bg-orange-50">{formatJMD(apData.totals?.days31to60 || 0)}</td>
                          <td className="py-2 px-3 text-right bg-red-50">{formatJMD(apData.totals?.days61to90 || 0)}</td>
                          <td className="py-2 px-3 text-right bg-red-100">{formatJMD(apData.totals?.days90plus || 0)}</td>
                          <td className="py-2 px-3 text-right">{formatJMD(apData.totals?.total || 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-6">No outstanding payables.</p>
                )}
              </CardContent>
            </Card>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">Business insights and financial reports</p>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">Date Range:</span>
            </div>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-40"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-40"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  setDateRange({
                    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
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
                  const firstDay = new Date(now.getFullYear(), 0, 1);
                  setDateRange({
                    start: firstDay.toISOString().split('T')[0],
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

      {/* Report Selection or Content */}
      {selectedReport ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              Back to Reports
            </Button>
            <h2 className="text-xl font-bold text-gray-900 flex-1">
              {REPORTS.find(r => r.id === selectedReport)?.name}
            </h2>
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
          {renderReportContent()}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {REPORTS.map((report) => {
            const Icon = report.icon;
            return (
              <Card
                key={report.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedReport(report.id)}
              >
                <CardContent className="p-6">
                  <div className={`inline-flex p-3 rounded-lg ${report.color} mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">{report.name}</h3>
                  <p className="text-sm text-gray-500">{report.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
