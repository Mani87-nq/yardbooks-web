/**
 * Plan enforcement & module gating for YaadBooks SaaS.
 *
 * CLIENT-SAFE — This file contains NO server-only imports (Prisma, etc.)
 * so it can be safely imported by 'use client' components.
 *
 * - Defines which features each subscription plan unlocks.
 * - Plans are cumulative: BUSINESS includes all STARTER features, etc.
 * - Provides frontend helpers for sidebar locking, upgrade badges, trial status.
 *
 * For API middleware (`requireFeature`), import from '@/lib/plan-gate.server'.
 */

// ============================================
// PLAN-TO-FEATURE MAPPING
// ============================================

/**
 * Features unique to each plan tier.
 * Access is cumulative -- higher plans inherit all features from lower ones.
 */
export const PLAN_FEATURES = {
  STARTER: [
    'dashboard', 'invoices', 'customers', 'expenses', 'inventory',
    'pos', 'basic_reports', 'gct_filing', 'settings', 'notifications',
  ],
  BUSINESS: [
    // Everything in STARTER plus:
    'recurring_invoices', 'credit_notes', 'bank_reconciliation',
    'payroll', 'advanced_reports', 'payment_reminders', 'customer_statements',
    'quotations', 'customer_po',
  ],
  PRO: [
    // Everything in BUSINESS plus:
    'multi_currency', 'api_access', 'custom_reports', 'audit_trail',
    'fixed_assets', 'ai_assistant', 'journal_entries', 'banking_import',
  ],
  ENTERPRISE: [
    // Everything in PRO plus:
    'custom_integrations', 'ai_auditor', 'parking_slip', 'unlimited',
  ],
} as const;

/** Ordered list of plans from lowest to highest tier. */
const PLAN_HIERARCHY: (keyof typeof PLAN_FEATURES)[] = [
  'STARTER',
  'BUSINESS',
  'PRO',
  'ENTERPRISE',
];

// ============================================
// ROUTE-TO-FEATURE MAPPING
// ============================================

/**
 * Maps each sidebar / page route to the feature key that controls access.
 * Used by both the frontend Sidebar and the Next.js middleware.
 */
export const ROUTE_TO_FEATURE: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/invoices': 'invoices',
  '/invoices/recurring': 'recurring_invoices',
  '/invoices/credit-notes': 'credit_notes',
  '/invoices/reminders': 'payment_reminders',
  '/customers': 'customers',
  '/customers/statements': 'customer_statements',
  '/quotations': 'quotations',
  '/inventory': 'inventory',
  '/expenses': 'expenses',
  '/accounting/chart': 'dashboard', // Basic GL always available
  '/accounting/journal': 'journal_entries',
  '/fixed-assets': 'fixed_assets',
  '/banking': 'dashboard', // Basic banking always available
  '/banking/reconciliation': 'bank_reconciliation',
  '/banking/import': 'banking_import',
  '/payroll': 'payroll',
  '/reports': 'basic_reports',
  '/reports/trial-balance': 'advanced_reports',
  '/reports/general-ledger': 'advanced_reports',
  '/reports/cash-flow': 'advanced_reports',
  '/reports/aging': 'advanced_reports',
  '/reports/audit-trail': 'audit_trail',
  '/ai': 'ai_assistant',
  '/ai-auditor': 'ai_auditor',
  '/pos': 'pos',
  '/customer-po': 'customer_po',
  '/parking-slip': 'parking_slip',
  '/settings': 'settings',
  '/notifications': 'notifications',
};

// ============================================
// FEATURE ACCESS HELPERS
// ============================================

/**
 * Get all features available for a given plan (cumulative).
 * e.g. getAvailableFeatures('BUSINESS') returns STARTER + BUSINESS features.
 */
export function getAvailableFeatures(plan: string): string[] {
  const planKey = plan.toUpperCase() as keyof typeof PLAN_FEATURES;
  const tierIndex = PLAN_HIERARCHY.indexOf(planKey);
  if (tierIndex === -1) return [...PLAN_FEATURES.STARTER]; // fallback

  const features: string[] = [];
  for (let i = 0; i <= tierIndex; i++) {
    features.push(...PLAN_FEATURES[PLAN_HIERARCHY[i]]);
  }
  return features;
}

/**
 * Check if a plan includes access to a specific feature.
 */
export function hasFeatureAccess(plan: string, feature: string): boolean {
  return getAvailableFeatures(plan).includes(feature);
}

/**
 * Determine the minimum plan required to access a given feature.
 * Returns the plan name (e.g. 'BUSINESS') or null if the feature is unknown.
 */
export function getMinimumPlan(feature: string): string | null {
  for (const plan of PLAN_HIERARCHY) {
    if (PLAN_FEATURES[plan].includes(feature as never)) {
      return plan;
    }
  }
  return null;
}

/**
 * For frontend display: determine the badge label for a locked feature.
 * Returns 'Business', 'Pro', or 'Enterprise' depending on which plan unlocks it.
 */
export function getUpgradeBadge(feature: string): string | null {
  const minPlan = getMinimumPlan(feature);
  if (!minPlan || minPlan === 'STARTER') return null;
  return minPlan.charAt(0) + minPlan.slice(1).toLowerCase(); // 'BUSINESS' -> 'Business'
}

// ============================================
// TRIAL STATUS
// ============================================

export interface TrialStatus {
  inTrial: boolean;
  daysRemaining: number;
  expired: boolean;
}

/**
 * Calculate trial status from a company record.
 * Expects the company to have subscriptionStatus and subscriptionEndDate fields.
 */
export function getTrialStatus(company: {
  subscriptionStatus?: string | null;
  subscriptionEndDate?: Date | string | null;
}): TrialStatus {
  if (company.subscriptionStatus !== 'TRIALING') {
    return { inTrial: false, daysRemaining: 0, expired: false };
  }

  const endDate = company.subscriptionEndDate
    ? new Date(company.subscriptionEndDate)
    : null;

  if (!endDate) {
    return { inTrial: true, daysRemaining: 0, expired: true };
  }

  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const expired = daysRemaining <= 0;

  return { inTrial: true, daysRemaining, expired };
}
