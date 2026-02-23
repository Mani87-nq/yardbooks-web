/**
 * GET  /api/v1/billing — Get current subscription status + plan info
 * POST /api/v1/billing — Create checkout session for plan upgrade
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { PLANS, getPlan, createCheckoutSession, getSubscriptionStatus, checkPlanLimits } from '@/lib/billing/service';

// ---- GET (Subscription Status) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const subscription = await getSubscriptionStatus(companyId!);
    const currentPlanId = subscription?.plan?.toLowerCase() ?? 'solo';
    const plan = getPlan(currentPlanId);

    return NextResponse.json({
      subscription: subscription ?? {
        isActive: false,
        plan: null,
        status: 'INACTIVE',
        currentPeriodEnd: null,
        trialDaysRemaining: 0,
      },
      plan: plan ?? null,
      plans: PLANS,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get billing info');
  }
}

// ---- POST (Create Checkout Session) ----

const checkoutSchema = z.object({
  planId: z.enum(['solo', 'team']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:update');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { planId, successUrl, cancelUrl } = parsed.data;

    const plan = getPlan(planId);
    if (!plan) {
      return badRequest('Invalid plan');
    }

    // Check if the user already has an active subscription for this plan
    const existing = await getSubscriptionStatus(companyId!);
    if (existing?.isActive && existing.plan?.toLowerCase() === planId) {
      return badRequest('Already subscribed to this plan');
    }

    const result = await createCheckoutSession({
      planId,
      companyId: companyId!,
      userId: user!.sub,
      email: user!.email,
      successUrl,
      cancelUrl,
    });

    if ('error' in result) {
      return internalError(result.error);
    }

    return NextResponse.json({ checkoutUrl: result.url });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create checkout session');
  }
}
