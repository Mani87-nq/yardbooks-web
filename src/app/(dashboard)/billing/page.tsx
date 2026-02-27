'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge,
} from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import api from '@/lib/api-client';
import {
  formatJmd,
  formatUsd,
  getPlan,
  type BillingInterval,
} from '@/lib/billing/plans';
import PricingCards from '@/components/billing/PricingCards';
import AddOnsSection from '@/components/billing/AddOnsSection';
import PlanComparison from '@/components/billing/PlanComparison';
import {
  CreditCardIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CubeIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

// ─── Types ──────────────────────────────────────────────────────

interface BillingSubscription {
  isActive: boolean;
  plan: string | null;
  status: string;
  currentPeriodEnd: string | null;
  trialDaysRemaining: number;
}

interface BillingUsage {
  users: number;
  maxUsers: number;
  invoicesThisMonth: number;
  maxInvoices: number;
  activeModules: number;
  maxModules: number;
}

interface BillingData {
  subscription: BillingSubscription;
  usage?: BillingUsage;
}

// ─── Status helpers ─────────────────────────────────────────────

function getStatusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'TRIALING': return 'warning';
    case 'PAST_DUE': return 'danger';
    case 'CANCELLED':
    case 'INACTIVE':
    default: return 'default';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Active';
    case 'TRIALING': return 'Trial';
    case 'PAST_DUE': return 'Past Due';
    case 'CANCELLED': return 'Cancelled';
    case 'INACTIVE': return 'Inactive';
    default: return status;
  }
}

// ─── Page Component ─────────────────────────────────────────────

export default function BillingPage() {
  const { activeCompany } = useAppStore();

  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Fetch billing data
  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<BillingData>('/api/v1/billing');
      setBillingData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  // Upgrade / Checkout handler
  const handleSelectPlan = async (planId: string, interval: BillingInterval) => {
    if (planId === currentPlanId) return;
    setCheckoutLoading(planId);
    try {
      const result = await api.post<{ checkoutUrl: string }>('/api/v1/billing', {
        planId,
        billingInterval: interval,
        successUrl: `${window.location.origin}/billing?success=true`,
        cancelUrl: `${window.location.origin}/billing`,
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Manage Subscription handler
  const handleManageSubscription = async () => {
    try {
      const result = await api.post<{ portalUrl: string }>('/api/v1/billing/portal');
      if (result.portalUrl) {
        window.location.href = result.portalUrl;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
  };

  // Current plan info
  const subscription = billingData?.subscription;
  const currentPlanId = subscription?.plan ?? 'free';
  const currentPlan = getPlan(currentPlanId);
  const status = subscription?.status ?? 'INACTIVE';
  const isTrialing = status === 'TRIALING';
  const trialDays = subscription?.trialDaysRemaining ?? 0;
  const TRIAL_LENGTH = 14;
  const trialProgress = TRIAL_LENGTH > 0
    ? Math.max(0, Math.min(100, ((TRIAL_LENGTH - trialDays) / TRIAL_LENGTH) * 100))
    : 0;

  // Usage stats (fallback to plan limits if not returned from API)
  const usage = billingData?.usage ?? {
    users: 1,
    maxUsers: currentPlan?.maxUsers ?? 1,
    invoicesThisMonth: 0,
    maxInvoices: currentPlan?.maxInvoicesPerMonth ?? 50,
    activeModules: 0,
    maxModules: currentPlan?.includesModules ?? 0,
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your subscription and billing</p>
        </div>
        <Card>
          <CardContent>
            <div className="flex items-center justify-center py-16">
              <ArrowPathIcon className="w-6 h-6 text-gray-400 animate-spin" />
              <span className="ml-3 text-gray-500 dark:text-gray-400">Loading billing information...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your subscription and billing</p>
        </div>
        <Card>
          <CardContent>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg">
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={fetchBilling}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your subscription, plan, and billing details
          </p>
        </div>
        {status === 'ACTIVE' && (
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            icon={<CreditCardIcon className="h-4 w-4" />}
          >
            Manage Subscription
          </Button>
        )}
      </div>

      {/* Trial Banner */}
      {isTrialing && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Your free trial ends in {trialDays} day{trialDays !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Upgrade now to keep using all features without interruption.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-yellow-600 dark:text-yellow-400 mb-1">
              <span>Trial started</span>
              <span>{trialDays} day{trialDays !== 1 ? 's' : ''} left</span>
            </div>
            <div className="h-2 bg-yellow-200 dark:bg-yellow-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                style={{ width: `${trialProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Status + Usage Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Subscription Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>Your active plan and billing details</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn(
              'rounded-lg p-4 border',
              status === 'ACTIVE' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
              status === 'TRIALING' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
              status === 'PAST_DUE' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
              'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {currentPlan?.name ?? 'Free'} Plan
                    </p>
                    <Badge variant={getStatusBadgeVariant(status)} size="sm">
                      {getStatusLabel(status)}
                    </Badge>
                  </div>
                  {currentPlan && currentPlan.priceJmd > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {formatJmd(currentPlan.priceJmd)}/mo ({formatUsd(currentPlan.priceUsd)}/mo)
                    </p>
                  )}
                  {currentPlan && currentPlan.priceJmd === 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Free forever &mdash; no credit card needed
                    </p>
                  )}
                </div>
              </div>

              {subscription?.currentPeriodEnd && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <CalendarDaysIcon className="h-4 w-4" />
                  <span>
                    {isTrialing ? 'Trial ends' : 'Next billing date'}:{' '}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-JM', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 mt-4">
              {status === 'ACTIVE' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageSubscription}
                  icon={<CreditCardIcon className="h-4 w-4" />}
                >
                  Update Payment Method
                </Button>
              )}
              {(status === 'INACTIVE' || status === 'CANCELLED' || currentPlanId === 'free') && (
                <Button
                  size="sm"
                  onClick={() => {
                    document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Upgrade Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Users */}
              <UsageStat
                icon={<UserGroupIcon className="h-4 w-4" />}
                label="Users"
                current={usage.users}
                max={usage.maxUsers}
              />

              {/* Invoices */}
              <UsageStat
                icon={<DocumentTextIcon className="h-4 w-4" />}
                label="Invoices this month"
                current={usage.invoicesThisMonth}
                max={usage.maxInvoices}
              />

              {/* Modules */}
              <UsageStat
                icon={<CubeIcon className="h-4 w-4" />}
                label="Active Modules"
                current={usage.activeModules}
                max={usage.maxModules}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Cards Section */}
      <div id="pricing-section">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Choose a Plan</CardTitle>
              <CardDescription>
                All plans include GCT compliance, bank reconciliation, and Jamaican payroll.
                No per-user fees on Professional and above.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PricingCards
              currentPlanId={currentPlanId}
              onSelectPlan={handleSelectPlan}
              loading={checkoutLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Feature Comparison */}
      <Card>
        <CardContent>
          <PlanComparison currentPlanId={currentPlanId} />
        </CardContent>
      </Card>

      {/* Add-Ons Section */}
      <Card>
        <CardContent>
          <AddOnsSection
            currentPlanId={currentPlanId}
            onAddAddOn={(addOnId) => {
              // TODO: implement add-on checkout
              alert(`Add-on checkout for "${addOnId}" coming soon!`);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Usage Stat Row ─────────────────────────────────────────────

function UsageStat({
  icon,
  label,
  current,
  max,
}: {
  icon: React.ReactNode;
  label: string;
  current: number;
  max: number;
}) {
  const isUnlimited = max === -1;
  const percentage = isUnlimited ? 0 : max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {current.toLocaleString('en-JM')}
          {' / '}
          {isUnlimited ? (
            <span className="text-emerald-600 dark:text-emerald-400">Unlimited</span>
          ) : (
            max.toLocaleString('en-JM')
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-emerald-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

