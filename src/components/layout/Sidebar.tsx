'use client';

import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import {
  hasFeatureAccess,
  getUpgradeBadge,
  getTrialStatus,
  ROUTE_TO_FEATURE,
} from '@/lib/plan-gate';
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
  LockClosedIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    name: 'Main',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
      { name: 'Point of Sale', href: '/pos', icon: ShoppingCartIcon, badge: 'NEW' },
    ],
  },
  {
    name: 'Sales',
    items: [
      { name: 'Invoices', href: '/invoices', icon: DocumentTextIcon },
      { name: 'Recurring Invoices', href: '/invoices/recurring', icon: ArrowPathIcon },
      { name: 'Credit Notes', href: '/invoices/credit-notes', icon: ReceiptRefundIcon },
      { name: 'Payment Reminders', href: '/invoices/reminders', icon: BellAlertIcon },
      { name: 'Customers', href: '/customers', icon: UserGroupIcon },
      { name: 'Customer Statements', href: '/customers/statements', icon: ClipboardDocumentListIcon },
      { name: 'Quotations', href: '/quotations', icon: DocumentTextIcon },
    ],
  },
  {
    name: 'Operations',
    items: [
      { name: 'Inventory', href: '/inventory', icon: CubeIcon },
      { name: 'Expenses', href: '/expenses', icon: BanknotesIcon },
    ],
  },
  {
    name: 'Accounting',
    items: [
      { name: 'Chart of Accounts', href: '/accounting/chart', icon: BookOpenIcon },
      { name: 'Journal Entries', href: '/accounting/journal', icon: BookOpenIcon },
      { name: 'Fixed Assets', href: '/fixed-assets', icon: WrenchScrewdriverIcon },
      { name: 'Banking', href: '/banking', icon: BuildingLibraryIcon },
      { name: 'Bank Reconciliation', href: '/banking/reconciliation', icon: ScaleIcon },
    ],
  },
  {
    name: 'HR & Payroll',
    items: [
      { name: 'Payroll', href: '/payroll', icon: UsersIcon },
    ],
  },
  {
    name: 'Reports & AI',
    items: [
      { name: 'Reports', href: '/reports', icon: ChartBarIcon },
      { name: 'Trial Balance', href: '/reports/trial-balance', icon: CalculatorIcon },
      { name: 'General Ledger', href: '/reports/general-ledger', icon: BookOpenIcon },
      { name: 'Cash Flow', href: '/reports/cash-flow', icon: ArrowTrendingUpIcon },
      { name: 'AR/AP Aging', href: '/reports/aging', icon: ClipboardDocumentListIcon },
      { name: 'Audit Trail', href: '/reports/audit-trail', icon: ShieldCheckIcon },
      { name: 'AI Assistant', href: '/ai', icon: SparklesIcon, badge: 'AI' },
    ],
  },
  {
    name: 'System',
    items: [
      { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar, setSidebarOpen, activeCompany } = useAppStore();

  // Determine current plan (accounting for trial expiry)
  const currentPlan = useMemo(() => {
    if (!activeCompany) return 'STARTER';

    // If trialing, check if trial is still valid
    if (activeCompany.subscriptionStatus === 'TRIALING') {
      const trial = getTrialStatus(activeCompany);
      if (trial.expired) return 'STARTER';
      return activeCompany.subscriptionPlan ?? 'STARTER';
    }

    // Active / past_due subscriptions keep their plan
    if (
      activeCompany.subscriptionStatus === 'ACTIVE' ||
      activeCompany.subscriptionStatus === 'PAST_DUE'
    ) {
      return activeCompany.subscriptionPlan ?? 'STARTER';
    }

    // Cancelled / inactive fall back to STARTER
    return 'STARTER';
  }, [activeCompany]);

  // Trial banner info
  const trialInfo = useMemo(() => {
    if (!activeCompany) return null;
    const trial = getTrialStatus(activeCompany);
    if (!trial.inTrial) return null;
    return trial;
  }, [activeCompany]);

  const handleLockedClick = useCallback(
    (e: React.MouseEvent, item: NavItem) => {
      e.preventDefault();
      const feature = ROUTE_TO_FEATURE[item.href];
      const badge = feature ? getUpgradeBadge(feature) : null;
      const planName = badge ?? 'a higher';
      // Navigate to billing page with upgrade context
      router.push(`/settings/billing?upgrade=${planName.toLowerCase()}&feature=${feature ?? ''}`);
    },
    [router],
  );

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

        {/* Trial Banner */}
        {sidebarOpen && trialInfo && !trialInfo.expired && (
          <div className="border-b border-gray-800 bg-amber-900/30 px-4 py-2">
            <div className="text-xs text-amber-300 font-medium">
              Free Trial: {trialInfo.daysRemaining} day{trialInfo.daysRemaining !== 1 ? 's' : ''} left
            </div>
            <Link
              href="/settings/billing"
              className="text-xs text-amber-400 hover:text-amber-300 underline"
            >
              Upgrade now
            </Link>
          </div>
        )}

        {/* Trial Expired Banner */}
        {sidebarOpen && trialInfo && trialInfo.expired && (
          <div className="border-b border-gray-800 bg-red-900/30 px-4 py-2">
            <div className="text-xs text-red-300 font-medium">
              Trial expired
            </div>
            <Link
              href="/settings/billing"
              className="text-xs text-red-400 hover:text-red-300 underline"
            >
              Subscribe to unlock features
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navigation.map((group) => (
            <div key={group.name} className="mb-4">
              {sidebarOpen && (
                <div className="px-4 mb-2 text-xs text-gray-500 uppercase tracking-wider">
                  {group.name}
                </div>
              )}
              <ul className="space-y-1 px-2">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  const feature = ROUTE_TO_FEATURE[item.href];
                  const isLocked = feature ? !hasFeatureAccess(currentPlan, feature) : false;
                  const upgradeBadge = feature ? getUpgradeBadge(feature) : null;

                  if (isLocked) {
                    return (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          onClick={(e) => handleLockedClick(e, item)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer',
                            'text-gray-600 hover:bg-gray-800/50',
                            !sidebarOpen && 'justify-center'
                          )}
                          title={!sidebarOpen ? `${item.name} (${upgradeBadge} plan)` : undefined}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0 opacity-40" />
                          {sidebarOpen && (
                            <>
                              <span className="flex-1 opacity-40">{item.name}</span>
                              <span className="flex items-center gap-1">
                                <LockClosedIcon className="h-3.5 w-3.5 text-gray-500" />
                                {upgradeBadge && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-700 text-gray-400 rounded">
                                    {upgradeBadge}
                                  </span>
                                )}
                              </span>
                            </>
                          )}
                        </a>
                      </li>
                    );
                  }

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
          ))}
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
