/**
 * YaadBooks Stripe Billing Service (Server-side)
 *
 * Re-exports client-safe plan definitions from ./plans.ts and adds
 * server-only functions that require Prisma/Stripe.
 *
 * Client components should import from '@/lib/billing/plans' directly
 * to avoid pulling in Node.js modules (pg, net, tls).
 */

// Re-export all client-safe types and functions
export {
  type SubscriptionPlan,
  type AddOn,
  type BillingInterval,
  PLANS,
  ADD_ONS,
  getPlan,
  checkPlanLimits,
  checkModuleAccess,
  migrateLegacyPlanId,
  formatJmd,
  formatUsd,
} from './plans';

import { getPlan, migrateLegacyPlanId } from './plans';

// ─── Stripe Checkout ──────────────────────────────────────────────

import type { BillingInterval } from './plans';

export async function createCheckoutSession(params: {
  planId: string;
  companyId: string;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  billingInterval?: BillingInterval;
}): Promise<{ url: string } | { error: string }> {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) return { error: 'Stripe not configured' };

  const plan = getPlan(params.planId);
  if (!plan) return { error: 'Invalid plan for checkout' };

  // Free tier doesn't need Stripe checkout
  if (plan.id === 'free') {
    return { error: 'Free plan does not require payment' };
  }

  const interval: BillingInterval = params.billingInterval ?? 'month';
  const priceUsd = interval === 'year' ? plan.priceUsdAnnual : plan.priceUsd;
  const productSuffix = interval === 'year' ? ' (Annual)' : ' (Monthly)';

  // Create Stripe checkout session via API
  // NOTE: Stripe processes in USD. Frontend displays JMD equivalent.
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'mode': 'subscription',
      'customer_email': params.email,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(Math.round(priceUsd * 100)),
      'line_items[0][price_data][recurring][interval]': interval,
      'line_items[0][price_data][product_data][name]': `YaadBooks ${plan.name}${productSuffix}`,
      'line_items[0][price_data][product_data][description]': plan.features.join(' • '),
      'line_items[0][quantity]': '1',
      'success_url': params.successUrl,
      'cancel_url': params.cancelUrl,
      'metadata[companyId]': params.companyId,
      'metadata[userId]': params.userId,
      'metadata[planId]': plan.id,
      'metadata[billingInterval]': interval,
      'allow_promotion_codes': 'true',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { error: `Stripe error: ${error}` };
  }

  const session = await response.json();
  return { url: session.url };
}

// ─── Subscription Status ──────────────────────────────────────────

export interface SubscriptionStatusResult {
  plan: string;
  planDetails: ReturnType<typeof getPlan>;
  status: string;
  isActive: boolean;
  trialDaysRemaining: number;
  currentPeriodEnd: Date | null;
}

/**
 * Query the Company model's subscription fields from Prisma and return
 * a normalized subscription status. Handles trial expiry detection.
 * Maps legacy plan IDs to new tiers.
 */
export async function getSubscriptionStatus(companyId: string): Promise<SubscriptionStatusResult | null> {
  const { default: prisma } = await import('@/lib/db');

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true,
    },
  });

  if (!company) return null;

  // Determine trial status
  let trialDaysRemaining = 0;
  let trialExpired = false;
  if (company.subscriptionStatus === 'TRIALING') {
    const endDate = company.subscriptionEndDate ? new Date(company.subscriptionEndDate) : null;
    if (!endDate) {
      trialExpired = true;
    } else {
      const diffMs = endDate.getTime() - Date.now();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      trialExpired = trialDaysRemaining <= 0;
    }
  }

  // Normalize plan ID (handle legacy values)
  let effectivePlan = migrateLegacyPlanId(company.subscriptionPlan ?? 'free');
  let effectiveStatus = company.subscriptionStatus ?? 'INACTIVE';

  if (effectiveStatus === 'TRIALING' && trialExpired) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'INACTIVE',
      },
    });
    effectivePlan = 'free';
    effectiveStatus = 'INACTIVE';
  }

  const isActive =
    effectiveStatus === 'ACTIVE' ||
    effectiveStatus === 'PAST_DUE' ||
    (effectiveStatus === 'TRIALING' && !trialExpired) ||
    effectivePlan === 'free'; // Free tier is always "active"

  return {
    plan: effectivePlan,
    planDetails: getPlan(effectivePlan),
    status: effectiveStatus,
    isActive,
    trialDaysRemaining,
    currentPeriodEnd: company.subscriptionEndDate ? new Date(company.subscriptionEndDate) : null,
  };
}
