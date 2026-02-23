/**
 * Plan enforcement API middleware for YaadBooks SaaS.
 *
 * SERVER-ONLY — This file imports Prisma and auth middleware.
 * Only import this from API routes / server components.
 *
 * For client-safe helpers (hasFeatureAccess, getUpgradeBadge, etc.),
 * import from '@/lib/plan-gate' instead.
 */
import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { apiError } from '@/lib/api-error';
import { hasFeatureAccess, getMinimumPlan, getTrialStatus } from '@/lib/plan-gate';

/**
 * API middleware that enforces plan-based feature access.
 *
 * Usage in any API route handler:
 * ```ts
 * import { requireFeature } from '@/lib/plan-gate.server';
 *
 * const { error: planError } = await requireFeature(request, 'payroll');
 * if (planError) return planError;
 * ```
 *
 * This function:
 * 1. Authenticates the user (returns 401 if not authenticated).
 * 2. Resolves the active company (returns 403 if none selected).
 * 3. Queries the company's subscription from the database.
 * 4. Checks trial expiration and downgrades to STARTER if expired.
 * 5. Verifies the plan includes the requested feature.
 * 6. Returns 403 with an upgrade message if the feature is locked.
 */
export async function requireFeature(
  request: NextRequest,
  feature: string,
): Promise<{ error: ReturnType<typeof apiError> | null }> {
  // 1. Auth check
  const { user, error: authError } = await requireAuth(request);
  if (authError) return { error: authError };

  // 2. Company check
  const { companyId, error: companyError } = requireCompany(user!);
  if (companyError) return { error: companyError };

  // 3. Load company subscription from DB
  const company = await prisma.company.findUnique({
    where: { id: companyId! },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionEndDate: true,
    },
  });

  if (!company) {
    return {
      error: apiError({
        type: 'company_not_found',
        title: 'Company Not Found',
        status: 404,
        detail: 'The active company could not be found.',
      }),
    };
  }

  // 4. Determine effective plan (handle trial expiry)
  let effectivePlan = company.subscriptionPlan ?? 'STARTER';

  if (company.subscriptionStatus === 'TRIALING') {
    const trial = getTrialStatus(company);
    if (trial.expired) {
      // Trial expired -- downgrade to STARTER in the database
      await prisma.company.update({
        where: { id: companyId! },
        data: {
          subscriptionPlan: 'STARTER',
          subscriptionStatus: 'INACTIVE',
        },
      });
      effectivePlan = 'STARTER';
    }
  } else if (
    company.subscriptionStatus === 'CANCELLED' ||
    company.subscriptionStatus === 'INACTIVE'
  ) {
    effectivePlan = 'STARTER';
  }

  // 5. Check feature access
  if (!hasFeatureAccess(effectivePlan, feature)) {
    const requiredPlan = getMinimumPlan(feature) ?? 'a higher';
    return {
      error: apiError({
        type: 'plan_limit_exceeded',
        title: 'Upgrade Required',
        status: 403,
        detail: `The "${feature}" feature requires the ${requiredPlan} plan or above. Please upgrade your subscription to access this feature.`,
      }),
    };
  }

  return { error: null };
}
