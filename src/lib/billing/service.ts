/**
 * Stripe billing integration for YaadBooks SaaS subscriptions.
 * Uses Stripe API directly via fetch (no SDK dependency).
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // Monthly price in JMD
  priceUsd: number; // Monthly USD
  priceUsdAnnual: number; // Annual USD (2 months free)
  maxUsers: number;
  maxCompanies: number;
  features: string[];
}

export const PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 2599, // ~$16.99 USD in JMD
    priceUsd: 16.99,
    priceUsdAnnual: 169.99, // 2 months free
    maxUsers: 1,
    maxCompanies: 1,
    features: ['Invoicing', 'Expenses', 'Basic Reports', 'POS', 'GCT Filing', 'Email Support'],
  },
  {
    id: 'business',
    name: 'Business',
    price: 5399, // ~$34.99 USD in JMD
    priceUsd: 34.99,
    priceUsdAnnual: 349.99, // 2 months free
    maxUsers: 3,
    maxCompanies: 1,
    features: ['All Starter features', 'Bank Reconciliation', 'Payroll', 'Recurring Invoices', 'Credit Notes', 'Advanced Reports', 'Priority Support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 10799, // ~$69.99 USD in JMD
    priceUsd: 69.99,
    priceUsdAnnual: 699.99, // 2 months free
    maxUsers: 10,
    maxCompanies: 3,
    features: ['All Business features', 'Multi-Currency', 'API Access', 'Custom Reports', 'Audit Trail', 'Phone Support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 23099, // ~$149.99 USD in JMD
    priceUsd: 149.99,
    priceUsdAnnual: 1499.99, // 2 months free
    maxUsers: -1, // Unlimited
    maxCompanies: -1,
    features: ['All Pro features', 'Unlimited Users', 'Unlimited Companies', 'Dedicated Account Manager', 'Custom Integrations', 'SLA', 'On-site Training'],
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

// Stripe API integration (requires STRIPE_SECRET_KEY env var)
export async function createCheckoutSession(params: {
  planId: string;
  companyId: string;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string } | { error: string }> {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) return { error: 'Stripe not configured' };

  const plan = getPlan(params.planId);
  if (!plan || plan.price === 0) return { error: 'Invalid plan for checkout' };

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
      'line_items[0][price_data][unit_amount]': String(Math.round(plan.priceUsd * 100)),
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][price_data][product_data][name]': `YaadBooks ${plan.name}`,
      'line_items[0][quantity]': '1',
      'success_url': params.successUrl,
      'cancel_url': params.cancelUrl,
      'metadata[companyId]': params.companyId,
      'metadata[userId]': params.userId,
      'metadata[planId]': params.planId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { error: `Stripe error: ${error}` };
  }

  const session = await response.json();
  return { url: session.url };
}

export async function getSubscriptionStatus(companyId: string): Promise<{
  active: boolean;
  planId?: string;
  periodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
} | null> {
  // For now, return null (no subscription).
  // In production, this would query Stripe's customer/subscription API.
  return null;
}
