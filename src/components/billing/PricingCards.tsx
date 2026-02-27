'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';
import {
  PLANS,
  formatJmd,
  formatUsd,
  type SubscriptionPlan,
  type BillingInterval,
} from '@/lib/billing/plans';
import {
  CheckCircleIcon,
  StarIcon,
  SparklesIcon,
  BuildingOfficeIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/solid';
import {
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

// ─── Tier Icon Mapping ──────────────────────────────────────────

const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  free: SparklesIcon,
  starter: RocketLaunchIcon,
  professional: StarIcon,
  business: BuildingOfficeIcon,
  enterprise: BuildingOfficeIcon,
};

// ─── Props ──────────────────────────────────────────────────────

interface PricingCardsProps {
  currentPlanId?: string;
  onSelectPlan?: (planId: string, interval: BillingInterval) => void;
  loading?: string | null;
}

// ─── Component ──────────────────────────────────────────────────

export default function PricingCards({
  currentPlanId = 'free',
  onSelectPlan,
  loading = null,
}: PricingCardsProps) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const isAnnual = billingInterval === 'year';

  return (
    <div>
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <span
          className={cn(
            'text-sm font-medium transition-colors',
            !isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
          )}
        >
          Monthly
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={isAnnual}
          onClick={() => setBillingInterval(isAnnual ? 'month' : 'year')}
          className={cn(
            'relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
            isAnnual ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition-transform duration-300 ease-in-out',
              isAnnual ? 'translate-x-7' : 'translate-x-0'
            )}
          />
        </button>

        <span
          className={cn(
            'text-sm font-medium transition-colors',
            isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
          )}
        >
          Annual
        </span>

        {isAnnual && (
          <Badge variant="success" size="sm" className="animate-in fade-in">
            2 months free
          </Badge>
        )}
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-6">
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            isAnnual={isAnnual}
            isCurrent={currentPlanId === plan.id}
            loading={loading === plan.id}
            onSelect={() => onSelectPlan?.(plan.id, billingInterval)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Individual Card ────────────────────────────────────────────

function PricingCard({
  plan,
  isAnnual,
  isCurrent,
  loading,
  onSelect,
}: {
  plan: SubscriptionPlan;
  isAnnual: boolean;
  isCurrent: boolean;
  loading: boolean;
  onSelect: () => void;
}) {
  const Icon = TIER_ICONS[plan.id] ?? SparklesIcon;
  const monthlyPrice = isAnnual ? plan.priceJmdAnnual / 10 : plan.priceJmd;
  const totalPrice = isAnnual ? plan.priceJmdAnnual : plan.priceJmd;
  const usdPrice = isAnnual ? plan.priceUsdAnnual : plan.priceUsd;
  const usdMonthly = isAnnual ? plan.priceUsdAnnual / 10 : plan.priceUsd;
  const isEnterprise = plan.id === 'enterprise';
  const isFree = plan.id === 'free';

  // CTA label
  let ctaLabel = 'Get Started';
  if (isCurrent) ctaLabel = 'Current Plan';
  else if (isEnterprise) ctaLabel = 'Contact Sales';
  else if (!isFree) ctaLabel = 'Upgrade';

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border-2 bg-white dark:bg-gray-800 p-6 shadow-sm transition-all duration-200 hover:shadow-md',
        plan.popular
          ? 'border-emerald-500 dark:border-emerald-400 ring-1 ring-emerald-500/20 dark:ring-emerald-400/20 shadow-emerald-100 dark:shadow-none'
          : isCurrent
            ? 'border-emerald-300 dark:border-emerald-600'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      {/* "Most Popular" Badge */}
      {plan.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            <StarIcon className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}

      {/* "Current Plan" Badge */}
      {isCurrent && !plan.popular && (
        <div className="absolute -top-3 left-4">
          <Badge variant="success" size="sm">Current Plan</Badge>
        </div>
      )}
      {isCurrent && plan.popular && (
        <div className="absolute -top-3 right-4">
          <Badge variant="success" size="sm">Current Plan</Badge>
        </div>
      )}

      {/* Plan Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            plan.popular
              ? 'bg-emerald-100 dark:bg-emerald-500/15'
              : 'bg-gray-100 dark:bg-gray-700'
          )}>
            <Icon className={cn(
              'h-4 w-4',
              plan.popular
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-600 dark:text-gray-400'
            )} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {plan.name}
          </h3>
        </div>
      </div>

      {/* Pricing */}
      <div className="mb-6">
        {isFree ? (
          <div>
            <span className="text-4xl font-bold text-gray-900 dark:text-white">Free</span>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No credit card required
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatJmd(Math.round(monthlyPrice))}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formatUsd(usdMonthly)}/mo
            </p>
            {isAnnual && (
              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {formatJmd(totalPrice)} billed annually
              </p>
            )}
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="flex-1 space-y-2.5 mb-6">
        {plan.features.map((feature, idx) => {
          const isHeader = feature.endsWith(':') || feature.startsWith('Everything in');
          return (
            <li key={idx} className="flex items-start gap-2">
              {isHeader ? (
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {feature}
                </span>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{feature}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {/* CTA */}
      <Button
        className="w-full"
        variant={plan.popular ? 'primary' : isCurrent ? 'outline' : 'secondary'}
        disabled={isCurrent || loading}
        loading={loading}
        onClick={onSelect}
        icon={!isCurrent && !loading ? <ArrowRightIcon className="h-4 w-4" /> : undefined}
      >
        {loading ? 'Redirecting...' : ctaLabel}
      </Button>
    </div>
  );
}
