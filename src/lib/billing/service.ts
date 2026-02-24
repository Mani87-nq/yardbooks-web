/**
 * Stripe billing integration for YaadBooks SaaS subscriptions.
 * Uses Stripe API directly via fetch (no SDK dependency).
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceUsd: number; // Monthly USD
  priceUsdAnnual: number; // Annual USD (2 months free)
  perUser: boolean; // If true, price is per-user
  maxUsers: number; // -1 = unlimited
  maxCompanies: number;
  features: string[];
}

export const PLANS: SubscriptionPlan[] = [
  {
    id: 'solo',
    name: 'Solo',
    priceUsd: 19.99,
    priceUsdAnnual: 199.99, // 2 months free
    perUser: false,
    maxUsers: 1,
    maxCompanies: 1,
    features: [
      'All features included',
      'Invoicing & Quotations',
      'POS System',
      'Inventory Management',
      'Payroll & Compliance',
      'Bank Reconciliation',
      'GCT & Tax Reports',
      'Email Support',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    priceUsd: 14.99,
    priceUsdAnnual: 149.99, // 2 months free
    perUser: true,
    maxUsers: -1, // Unlimited
    maxCompanies: -1,
    features: [
      'Everything in Solo, plus:',
      'Unlimited users',
      'Unlimited companies',
      'All features included',
      'Priority Support',
    ],
  },
];

export function getPlan(planId: string): SubscriptionPlan | undefined {
  return PLANS.find(p => p.id === planId);
}

export function checkPlanLimits(planId: string, currentUsers: number, currentCompanies: number): { withinLimits: boolean; userLimit: number; companyLimit: number } {
  const plan = getPlan(planId);
  if (!plan) return { withinLimits: false, userLimit: 0, companyLimit: 0 };

  const withinLimits =
    (plan.maxUsers === -1 || currentUsers <= plan.maxUsers) &&
    (plan.maxCompanies === -1 || currentCompanies <= plan.maxCompanies);

  return { withinLimits, userLimit: plan.maxUsers, companyLimit: plan.maxCompanies };
}

/**
 * Map legacy plan IDs (starter, business, pro, enterprise) to the new model.
 * Solo users -> 'solo', everyone else -> 'team'.
 */
export function migrateLegacyPlanId(planId: string): string {
  if (planId === 'solo' || planId === 'team') return planId;
  // Legacy mapping: starter maps to solo, everything else maps to team
  if (planId === 'starter') return 'solo';
  return 'team';
}

export type BillingInterval = 'month' | 'year';

// Stripe API integration (requires STRIPE_SECRET_KEY env var)
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

  const interval: BillingInterval = params.billingInterval ?? 'month';
  const priceUsd = interval === 'year' ? plan.priceUsdAnnual : plan.priceUsd;
  const productSuffix = interval === 'year' ? ' (Annual)' : ' (Monthly)';

  // Create Stripe checkout session via API
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
      'line_items[0][quantity]': '1',
      'success_url': params.successUrl,
      'cancel_url': params.cancelUrl,
      'metadata[companyId]': params.companyId,
      'metadata[userId]': params.userId,
      'metadata[planId]': params.planId,
      'metadata[billingInterval]': interval,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { error: `Stripe error: ${error}` };
  }

  const session = await response.json();
  return { url: session.url };
}

export interface SubscriptionStatusResult {
  plan: string;
  status: string;
  isActive: boolean;
  trialDaysRemaining: number;
  currentPeriodEnd: Date | null;
}

/**
 * Query the Company model's subscription fields from Prisma and return
 * a normalized subscription status. Handles trial expiry detection.
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

  // Determine trial status inline (no plan-gate dependency)
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

  let effectivePlan = company.subscriptionPlan ?? 'SOLO';
  let effectiveStatus = company.subscriptionStatus ?? 'INACTIVE';

  if (effectiveStatus === 'TRIALING' && trialExpired) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        subscriptionPlan: 'SOLO',
        subscriptionStatus: 'INACTIVE',
      },
    });
    effectivePlan = 'SOLO';
    effectiveStatus = 'INACTIVE';
  }

  const isActive =
    effectiveStatus === 'ACTIVE' ||
    effectiveStatus === 'PAST_DUE' ||
    (effectiveStatus === 'TRIALING' && !trialExpired);

  return {
    plan: effectivePlan,
    status: effectiveStatus,
    isActive,
    trialDaysRemaining,
    currentPeriodEnd: company.subscriptionEndDate ? new Date(company.subscriptionEndDate) : null,
  };
}
