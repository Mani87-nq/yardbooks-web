'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, StatusBadge } from '@/components/ui';
import { useAppStore, useDashboardStats, useRecentInvoices, useLowStockProducts } from '@/store/appStore';
import { formatJMD, formatDate, formatRelativeTime } from '@/lib/utils';
import {
  BanknotesIcon,
  DocumentTextIcon,
  CubeIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  ShoppingCartIcon,
  PlusIcon,
  ChartBarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

// Quick Action Component
function QuickAction({
  icon: Icon,
  title,
  href,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
    >
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <span className="text-sm font-medium text-gray-700">{title}</span>
    </Link>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              {changeType === 'positive' && (
                <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-500" />
              )}
              {changeType === 'negative' && (
                <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  changeType === 'positive'
                    ? 'text-emerald-600'
                    : changeType === 'negative'
                    ? 'text-red-600'
                    : 'text-gray-500'
                }`}
              >
                {change}
              </span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { activeCompany } = useAppStore();
  const stats = useDashboardStats();
  const recentInvoices = useRecentInvoices(5);
  const lowStockProducts = useLowStockProducts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            Welcome back! Here&apos;s what&apos;s happening with {activeCompany?.businessName || 'your business'}.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" icon={<ChartBarIcon className="w-4 h-4" />}>
            <Link href="/reports">View Reports</Link>
          </Button>
          <Button icon={<PlusIcon className="w-4 h-4" />}>
            <Link href="/invoices/new">New Invoice</Link>
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <QuickAction icon={ShoppingCartIcon} title="Point of Sale" href="/pos" color="bg-emerald-600" />
            <QuickAction icon={DocumentTextIcon} title="New Invoice" href="/invoices/new" color="bg-blue-600" />
            <QuickAction icon={UserGroupIcon} title="Add Customer" href="/customers/new" color="bg-purple-600" />
            <QuickAction icon={CubeIcon} title="Add Product" href="/inventory/new" color="bg-orange-600" />
            <QuickAction icon={BanknotesIcon} title="Add Expense" href="/expenses/new" color="bg-red-600" />
            <QuickAction icon={SparklesIcon} title="AI Assistant" href="/ai" color="bg-indigo-600" />
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue (This Month)"
          value={formatJMD(stats.totalRevenue)}
          change={`${stats.invoiceCount ?? 0} invoices`}
          changeType="neutral"
          icon={BanknotesIcon}
          color="bg-emerald-600"
        />
        <StatCard
          title="Accounts Receivable"
          value={formatJMD(stats.totalReceivable)}
          change={`${stats.overdueCount} overdue`}
          changeType={stats.overdueCount > 0 ? 'negative' : 'neutral'}
          icon={DocumentTextIcon}
          color="bg-blue-600"
        />
        <StatCard
          title="Expenses (This Month)"
          value={formatJMD(stats.totalExpenses)}
          change={`${stats.expenseCount ?? 0} expenses`}
          changeType="neutral"
          icon={BanknotesIcon}
          color="bg-red-500"
        />
        <StatCard
          title="Net Profit"
          value={formatJMD(stats.profit)}
          change={stats.profit > 0 ? 'Profitable' : 'Loss'}
          changeType={stats.profit > 0 ? 'positive' : 'negative'}
          icon={ArrowTrendingUpIcon}
          color="bg-purple-600"
        />
      </div>

      {/* Lower Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <Link href="/invoices" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No invoices yet</p>
                <Link href="/invoices/new" className="text-emerald-600 hover:underline text-sm">
                  Create your first invoice
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-gray-500">
                        {invoice.customer?.name || 'Unknown'} • {formatRelativeTime(invoice.issueDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatJMD(invoice.total)}</p>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Alerts</CardTitle>
            <Link href="/inventory" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              View inventory
            </Link>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CubeIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>All stock levels are good!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    href={`/inventory/${product.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-red-600">{product.quantity} left</p>
                      <p className="text-xs text-gray-500">Reorder at {product.reorderLevel}</p>
                    </div>
                  </Link>
                ))}
                {lowStockProducts.length > 5 && (
                  <p className="text-center text-sm text-gray-500 pt-2">
                    +{lowStockProducts.length - 5} more items low on stock
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Jamaica-specific info */}
      <Card className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">GCT Ready</h3>
              <p className="text-emerald-100 text-sm">
                YaadBooks automatically calculates GCT at 15% on all applicable transactions.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm">
                <Link href="/reports/gct">View GCT Report</Link>
              </Button>
              <Button variant="outline" size="sm" className="border-white text-white hover:bg-white/10">
                <Link href="/settings">Configure Rates</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
