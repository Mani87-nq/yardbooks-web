/**
 * POST /api/webhooks/stripe — Handle Stripe webhook events
 *
 * No auth middleware — uses Stripe signature verification instead.
 * Handles: checkout.session.completed, invoice.paid,
 *          customer.subscription.updated, customer.subscription.deleted
 */
import { NextRequest, NextResponse } from 'next/server';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Verify the Stripe webhook signature using HMAC-SHA256.
 * This replaces the Stripe SDK's constructEvent method.
 */
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const v1Signature = parts['v1'];

  if (!timestamp || !v1Signature) return false;

  // Reject events older than 5 minutes to prevent replay attacks
  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (timestampAge > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );

  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return expectedSignature === v1Signature;
}

// ---- Webhook Event Handlers ----

async function handleCheckoutCompleted(event: Record<string, unknown>) {
  const session = event.data as Record<string, unknown>;
  const obj = session.object as Record<string, unknown>;
  const metadata = obj.metadata as Record<string, string> | undefined;

  const companyId = metadata?.companyId;
  const userId = metadata?.userId;
  const planId = metadata?.planId;
  const subscriptionId = obj.subscription as string | undefined;
  const customerId = obj.customer as string | undefined;

  console.log('[stripe:checkout.session.completed]', {
    companyId,
    userId,
    planId,
    subscriptionId,
    customerId,
  });

  // TODO: In production, update the company record with the Stripe customer ID,
  // subscription ID, and active plan. Example:
  // await prisma.company.update({
  //   where: { id: companyId },
  //   data: { stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, planId },
  // });
}

async function handleInvoicePaid(event: Record<string, unknown>) {
  const invoice = event.data as Record<string, unknown>;
  const obj = invoice.object as Record<string, unknown>;
  const subscriptionId = obj.subscription as string | undefined;
  const amountPaid = obj.amount_paid as number | undefined;

  console.log('[stripe:invoice.paid]', {
    subscriptionId,
    amountPaid,
  });

  // TODO: Record payment in billing history, extend subscription period.
}

async function handleSubscriptionUpdated(event: Record<string, unknown>) {
  const subscription = event.data as Record<string, unknown>;
  const obj = subscription.object as Record<string, unknown>;
  const subscriptionId = obj.id as string;
  const status = obj.status as string;
  const cancelAtPeriodEnd = obj.cancel_at_period_end as boolean;
  const currentPeriodEnd = obj.current_period_end as number | undefined;

  console.log('[stripe:customer.subscription.updated]', {
    subscriptionId,
    status,
    cancelAtPeriodEnd,
    currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
  });

  // TODO: Update subscription status in the database.
  // Handle plan changes, cancellation scheduling, etc.
}

async function handleSubscriptionDeleted(event: Record<string, unknown>) {
  const subscription = event.data as Record<string, unknown>;
  const obj = subscription.object as Record<string, unknown>;
  const subscriptionId = obj.id as string;

  console.log('[stripe:customer.subscription.deleted]', {
    subscriptionId,
  });

  // TODO: Mark the company's subscription as inactive.
  // Potentially downgrade to a free tier or restrict access.
}

// ---- POST Handler ----

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('[stripe:webhook] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const isValid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.warn('[stripe:webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const event = JSON.parse(body) as Record<string, unknown>;
    const eventType = event.type as string;

    console.log(`[stripe:webhook] Received event: ${eventType}`);

    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      default:
        console.log(`[stripe:webhook] Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe:webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
