'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/lib/auth/rbac';
import {
  HomeIcon,
  ShoppingCartIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CubeIcon,
  BanknotesIcon,
  BookOpenIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowPathIcon,
  ReceiptRefundIcon,
  BellAlertIcon,
  ClipboardDocumentListIcon,
  ScaleIcon,
  CalculatorIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  /** Permission required to see this item. null = visible to everyone. */
  permission?: Permission | null;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    name: 'Main',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, permission: null },
      { name: 'Point of Sale', href: '/pos', icon: ShoppingCartIcon, badge: 'NEW', permission: 'pos:read' },
    ],
  },
  {
    name: 'Sales',
    items: [
      { name: 'Invoices', href: '/invoices', icon: DocumentTextIcon, permission: 'invoices:read' },
      { name: 'Recurring Invoices', href: '/invoices/recurring', icon: ArrowPathIcon, permission: 'invoices:read' },
      { name: 'Credit Notes', href: '/invoices/credit-notes', icon: ReceiptRefundIcon, permission: 'invoices:read' },
      { name: 'Payment Reminders', href: '/invoices/reminders', icon: BellAlertIcon, permission: 'invoices:read' },
      { name: 'Customers', href: '/customers', icon: UserGroupIcon, permission: 'customers:read' },
      { name: 'Customer Statements', href: '/customers/statements', icon: ClipboardDocumentListIcon, permission: 'customers:read' },
      { name: 'Quotations', href: '/quotations', icon: DocumentTextIcon, permission: 'quotations:read' },
    ],
  },
  {
    name: 'Operations',
    items: [
      { name: 'Inventory', href: '/inventory', icon: CubeIcon, permission: 'inventory:read' },
      { name: 'Expenses', href: '/expenses', icon: BanknotesIcon, permission: 'expenses:read' },
    ],
  },
  {
    name: 'Accounting',
    items: [
      { name: 'Chart of Accounts', href: '/accounting/chart', icon: BookOpenIcon, permission: 'gl:read' },
      { name: 'Journal Entries', href: '/accounting/journal', icon: BookOpenIcon, permission: 'journal:read' },
      { name: 'Fixed Assets', href: '/fixed-assets', icon: WrenchScrewdriverIcon, permission: 'fixed_assets:read' },
      { name: 'Banking', href: '/banking', icon: BuildingLibraryIcon, permission: 'banking:read' },
      { name: 'Bank Reconciliation', href: '/banking/reconciliation', icon: ScaleIcon, permission: 'banking:reconcile' },
    ],
  },
  {
    name: 'HR & Payroll',
    items: [
      { name: 'Payroll', href: '/payroll', icon: UsersIcon, permission: 'payroll:read' },
    ],
  },
  {
    name: 'Reports & AI',
    items: [
      { name: 'Reports', href: '/reports', icon: ChartBarIcon, permission: 'reports:read' },
      { name: 'Trial Balance', href: '/reports/trial-balance', icon: CalculatorIcon, permission: 'reports:read' },
      { name: 'General Ledger', href: '/reports/general-ledger', icon: BookOpenIcon, permission: 'reports:read' },
      { name: 'Cash Flow', href: '/reports/cash-flow', icon: ArrowTrendingUpIcon, permission: 'reports:read' },
      { name: 'AR/AP Aging', href: '/reports/aging', icon: ClipboardDocumentListIcon, permission: 'reports:read' },
      { name: 'Audit Trail', href: '/reports/audit-trail', icon: ShieldCheckIcon, permission: 'audit:read' },
      { name: 'AI Assistant', href: '/ai', icon: SparklesIcon, badge: 'AI', permission: null },
    ],
  },
  {
    name: 'System',
    items: [
      { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, permission: 'settings:read' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, setSidebarOpen, activeCompany } = useAppStore();
  const { can } = usePermissions();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-gray-900 text-white transition-all duration-300 lg:relative',
          sidebarOpen ? 'w-64' : 'w-20',
          !sidebarOpen && 'lg:w-20',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-lg">
              YB
            </div>
            {sidebarOpen && (
              <span className="text-lg font-semibold">YaadBooks</span>
            )}
          </Link>
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-800"
          >
            {sidebarOpen ? (
              <ChevronLeftIcon className="h-5 w-5" />
            ) : (
              <ChevronRightIcon className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-800"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Company Selector */}
        {sidebarOpen && activeCompany && (
          <div className="border-b border-gray-800 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Company
            </div>
            <div className="text-sm font-medium truncate">
              {activeCompany.businessName}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navigation.map((group) => {
            const visibleItems = group.items.filter((item) => !item.permission || can(item.permission));
            if (visibleItems.length === 0) return null;
            return (
            <div key={group.name} className="mb-4">
              {sidebarOpen && (
                <div className="px-4 mb-2 text-xs text-gray-500 uppercase tracking-wider">
                  {group.name}
                </div>
              )}
              <ul className="space-y-1 px-2">
                {group.items
                  .filter((item) => !item.permission || can(item.permission))
                  .map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-emerald-600 text-white'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                          !sidebarOpen && 'justify-center'
                        )}
                        title={!sidebarOpen ? item.name : undefined}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {sidebarOpen && (
                          <>
                            <span className="flex-1">{item.name}</span>
                            {item.badge && (
                              <span className="px-2 py-0.5 text-xs bg-emerald-500 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
          })}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="border-t border-gray-800 p-4">
            <div className="text-xs text-gray-500 text-center">
              Made with love in Jamaica
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
