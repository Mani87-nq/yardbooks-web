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
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

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
