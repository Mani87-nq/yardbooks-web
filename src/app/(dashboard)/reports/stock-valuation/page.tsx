'use client';

import React, { useState } from 'react';
import {
  Card,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import { useCurrency } from '@/hooks/useCurrency';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
  CubeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { printContent, downloadAsCSV, generateTable, generateStatCards, formatPrintCurrency } from '@/lib/print';
import { useAppStore } from '@/store/appStore';

interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costingMethod: string;
  quantity: number;
  averageCost: number;
  costPrice: number;
  totalValue: number;
  unitPrice: number;
  retailValue: number;
  potentialMargin: number;
  reorderLevel: number;
  isLowStock: boolean;
}

interface CategorySummary {
  category: string;
  itemCount: number;
  totalQuantity: number;
  totalCostValue: number;
  totalRetailValue: number;
  potentialMargin: number;
}

interface StockReport {
  report: string;
  asOfDate: string;
  currency: string;
  summary: {
    totalProducts: number;
    totalCostValue: number;
    totalRetailValue: number;
    potentialGrossProfit: number;
    potentialGrossMargin: number;
    lowStockItems: number;
  };
  categories: CategorySummary[];
  items: StockItem[];
}

export default function StockValuationPage() {
  const { fc } = useCurrency();
  const { activeCompany } = useAppStore();
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stock-valuation', showLowStockOnly],
    queryFn: () =>
      api.get<StockReport>(
        `/api/v1/reports/stock-valuation${showLowStockOnly ? '?lowStock=true' : ''}`
      ),
  });

  const report: StockReport | null = (data as any) ?? null;

  const handlePrint = () => {
    if (!report) return;
    const currency = report.currency ?? 'JMD';
    const summaryHtml = generateStatCards([
      { label: 'Total Products', value: report.summary.totalProducts.toString() },
      { label: 'Cost Value', value: formatPrintCurrency(report.summary.totalCostValue, currency) },
      { label: 'Retail Value', value: formatPrintCurrency(report.summary.totalRetailValue, currency) },
      { label: 'Potential Margin', value: `${report.summary.potentialGrossMargin.toFixed(1)}%` },
      { label: 'Low Stock Items', value: report.summary.lowStockItems.toString(), color: report.summary.lowStockItems > 0 ? '#dc2626' : '#059669' },
    ]);
    const tableHtml = generateTable(
      [
        { key: 'name', label: 'Product' },
        { key: 'sku', label: 'SKU' },
        { key: 'category', label: 'Category' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'averageCost', label: 'Avg Cost', align: 'right' },
        { key: 'totalValue', label: 'Total Value', align: 'right' },
        { key: 'unitPrice', label: 'Retail', align: 'right' },
        { key: 'margin', label: 'Margin', align: 'right' },
      ],
      report.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: `${item.quantity} ${item.unit}`,
        averageCost: item.averageCost,
        totalValue: item.totalValue,
        unitPrice: item.unitPrice,
        margin: `${item.potentialMargin.toFixed(1)}%`,
      })),
      {
        formatters: {
          averageCost: (v: number) => formatPrintCurrency(v, currency),
          totalValue: (v: number) => formatPrintCurrency(v, currency),
          unitPrice: (v: number) => formatPrintCurrency(v, currency),
        },
      }
    );
    printContent({
      title: 'Stock Valuation Report',
      subtitle: `As of ${report.asOfDate}`,
      companyName: activeCompany?.businessName,
      companyTrn: activeCompany?.trnNumber,
      content: summaryHtml + tableHtml,
    });
  };

  const handleExportCSV = () => {
    if (!report) return;
    downloadAsCSV(
      report.items.map((item) => ({
        Product: item.name,
        SKU: item.sku,
        Category: item.category,
        Quantity: item.quantity,
        Unit: item.unit,
        'Average Cost': item.averageCost,
        'Total Value': item.totalValue,
        'Unit Price': item.unitPrice,
        'Retail Value': item.retailValue,
        'Potential Margin %': item.potentialMargin.toFixed(1),
        'Low Stock': item.isLowStock ? 'Yes' : 'No',
        'Reorder Level': item.reorderLevel,
      })),
      `stock-valuation-${report.asOfDate}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Stock Valuation Report
          </h1>
          <p className="text-gray-500">
            Inventory value using weighted average cost method
            {report?.asOfDate && (
              <span className="ml-1 text-xs">(as of {report.asOfDate})</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Low stock only
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Print / Export Toolbar */}
      {report && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800 flex-1">
            Failed to load stock valuation.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <Card>
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
            <p className="text-gray-500">Calculating stock valuation...</p>
          </div>
        </Card>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">
                  {report.summary.totalProducts}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Cost Value</p>
                <p className="text-xl font-bold text-blue-700">
                  {fc(report.summary.totalCostValue)}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Retail Value</p>
                <p className="text-xl font-bold text-emerald-700">
                  {fc(report.summary.totalRetailValue)}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Potential Margin</p>
                <p className="text-xl font-bold text-purple-700">
                  {report.summary.potentialGrossMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400">
                  {fc(report.summary.potentialGrossProfit)} profit
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Low Stock Items</p>
                <p
                  className={`text-2xl font-bold ${
                    report.summary.lowStockItems > 0
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {report.summary.lowStockItems}
                </p>
              </div>
            </Card>
          </div>

          {/* Category Summary */}
          {report.categories.length > 0 && (
            <Card>
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-800">
                  By Category
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {report.categories.map((cat) => (
                    <div
                      key={cat.category}
                      className="border rounded-lg p-3 bg-gray-50"
                    >
                      <p className="font-medium text-gray-900 text-sm">
                        {cat.category}
                      </p>
                      <div className="flex justify-between mt-1 text-xs text-gray-500">
                        <span>{cat.itemCount} items</span>
                        <span className="font-medium text-gray-700">
                          {fc(cat.totalCostValue)}
                        </span>
                      </div>
                      <div className="flex justify-between mt-0.5 text-xs text-gray-500">
                        <span>{cat.totalQuantity} units</span>
                        <span className="text-emerald-600">
                          {cat.potentialMargin.toFixed(1)}% margin
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Products Table */}
          <Card padding="none">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-12 text-gray-500"
                      >
                        <CubeIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p>No products found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.items.map((item) => (
                      <TableRow
                        key={item.id}
                        className={item.isLowStock ? 'bg-red-50/30' : ''}
                      >
                        <TableCell>
                          <p className="font-medium text-gray-900 text-sm">
                            {item.name}
                          </p>
                        </TableCell>
                        <TableCell className="text-gray-500 font-mono text-xs">
                          {item.sku}
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {item.category}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fc(item.averageCost)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium text-blue-700">
                          {fc(item.totalValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fc(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span
                            className={
                              item.potentialMargin >= 20
                                ? 'text-emerald-600'
                                : item.potentialMargin >= 0
                                ? 'text-amber-600'
                                : 'text-red-600'
                            }
                          >
                            {item.potentialMargin.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.isLowStock ? (
                            <Badge variant="warning">
                              <ExclamationTriangleIcon className="w-3 h-3 mr-1 inline" />
                              Low
                            </Badge>
                          ) : (
                            <Badge variant="success">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
