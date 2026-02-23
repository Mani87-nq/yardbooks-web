import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, getPlan } from '@/lib/billing/service';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { planId, companyId, userId, email } = body;

    if (!planId || !companyId || !userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, companyId, userId, email' },
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yaadbooks.com';
    
    const result = await createCheckoutSession({
      planId,
      companyId,
      userId,
      email,
      successUrl: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/billing/cancelled`,
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
