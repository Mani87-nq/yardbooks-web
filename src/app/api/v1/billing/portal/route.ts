/**
 * POST /api/v1/billing/portal — Create a Stripe billing portal session
 *
 * Returns a URL the frontend can redirect to so the customer can manage
 * their subscription, update payment methods, view invoices, etc.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    // Get the company's Stripe customer ID
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { stripeCustomerId: true },
    });

    if (!company?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe to a plan first.' },
        { status: 400 }
      );
    }

    // Parse optional return URL from request body
    let returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yaadbooks.com'}/settings/billing`;
    try {
      const body = await request.json();
      if (body.returnUrl) {
        returnUrl = body.returnUrl;
      }
    } catch {
      // No body or invalid JSON — use default return URL
    }

    // Create a Stripe billing portal session via the API
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: company.stripeCustomerId,
        return_url: returnUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BILLING] Failed to create portal session:', errorText);
      return NextResponse.json(
        { error: 'Failed to create billing portal session' },
        { status: 500 }
      );
    }

    const session = await response.json();

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[BILLING] Portal session error:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}
