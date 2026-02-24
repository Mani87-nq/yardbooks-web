/**
 * POST /api/billing/checkout — Create Stripe checkout session.
 *
 * Security: Requires authentication. Uses the authenticated user's
 * companyId/userId/email so callers cannot impersonate other users.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { createCheckoutSession, getPlan } from '@/lib/billing/service';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate + authorize
    const { user, error: authError } = await requirePermission(request, 'settings:update');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // 2. Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { planId, billingInterval } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'Missing required field: planId' },
        { status: 400 }
      );
    }

    const plan = getPlan(planId);
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    const interval = billingInterval === 'year' ? 'year' as const : 'month' as const;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yaadbooks.com';

    const result = await createCheckoutSession({
      planId,
      companyId: companyId!,
      userId: user!.sub,
      email: user!.email,
      successUrl: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/billing/cancelled`,
      billingInterval: interval,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
