import { NextRequest, NextResponse } from 'next/server';

// Stripe webhook handler for subscription events
// TODO: Add database updates once schema is migrated
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // For now, parse the event directly (add signature verification in production)
  // TODO: Add STRIPE_WEBHOOK_SECRET and verify signature
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { companyId, userId, planId } = session.metadata || {};
        console.log(`✅ Checkout completed - Company: ${companyId}, Plan: ${planId}, User: ${userId}`);
        // TODO: Update company subscription status in database
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log(`📝 Subscription updated - Status: ${subscription.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log(`❌ Subscription cancelled - ID: ${subscription.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
