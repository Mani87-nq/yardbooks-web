/**
 * POST /api/webhooks/stripe — Handle Stripe webhook events
 *
 * No auth middleware — uses Stripe signature verification instead.
 * Handles: checkout.session.completed, invoice.paid,
 *          customer.subscription.updated, customer.subscription.deleted
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

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

// ─── Helper: Map Stripe plan ID to SubscriptionPlan enum ──────────

function mapPlanId(planId: string | undefined): 'SOLO' | 'TEAM' {
  if (planId === 'team') return 'TEAM';
  return 'SOLO';
}

// ─── Webhook Event Handlers (with real DB updates) ────────────────

async function handleCheckoutCompleted(event: Record<string, unknown>) {
  const session = event.data as Record<string, unknown>;
  const obj = session.object as Record<string, unknown>;
  const metadata = obj.metadata as Record<string, string> | undefined;

  const companyId = metadata?.companyId;
  const planId = metadata?.planId;
  const subscriptionId = obj.subscription as string | undefined;
  const customerId = obj.customer as string | undefined;

  console.log('[stripe:checkout.session.completed]', { companyId, planId, subscriptionId, customerId });

  if (!companyId) {
    console.error('[stripe:checkout] Missing companyId in metadata');
    return;
  }

  // Update the company with Stripe IDs and activate subscription
  await prisma.company.update({
    where: { id: companyId },
    data: {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscriptionId ?? undefined,
      subscriptionPlan: mapPlanId(planId),
      subscriptionStatus: 'ACTIVE',
      subscriptionStartDate: new Date(),
      // Set subscription end to 30 days (will be updated by invoice.paid)
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`[stripe:checkout] Company ${companyId} upgraded to ${planId ?? 'SOLO'} plan`);
}

async function handleInvoicePaid(event: Record<string, unknown>) {
  const invoice = event.data as Record<string, unknown>;
  const obj = invoice.object as Record<string, unknown>;
  const subscriptionId = obj.subscription as string | undefined;
  const amountPaid = obj.amount_paid as number | undefined;
  const periodEnd = obj.lines as any;

  console.log('[stripe:invoice.paid]', { subscriptionId, amountPaid });

  if (!subscriptionId) return;

  // Find the company by Stripe subscription ID
  const company = await prisma.company.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!company) {
    console.error(`[stripe:invoice.paid] No company found for subscription ${subscriptionId}`);
    return;
  }

  // Extend subscription period (Stripe sends current_period_end in the subscription object)
  // For now, extend by 30 days from today
  await prisma.company.update({
    where: { id: company.id },
    data: {
      subscriptionStatus: 'ACTIVE',
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`[stripe:invoice.paid] Company ${company.id} subscription extended, amount: ${amountPaid}`);
}

async function handleSubscriptionUpdated(event: Record<string, unknown>) {
  const subscription = event.data as Record<string, unknown>;
  const obj = subscription.object as Record<string, unknown>;
  const subscriptionId = obj.id as string;
  const status = obj.status as string;
  const cancelAtPeriodEnd = obj.cancel_at_period_end as boolean;
  const currentPeriodEnd = obj.current_period_end as number | undefined;

  console.log('[stripe:subscription.updated]', { subscriptionId, status, cancelAtPeriodEnd, currentPeriodEnd });

  // Find the company
  const company = await prisma.company.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!company) {
    console.error(`[stripe:subscription.updated] No company found for subscription ${subscriptionId}`);
    return;
  }

  // Map Stripe status to our SubscriptionStatus
  let dbStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INACTIVE' = 'ACTIVE';
  switch (status) {
    case 'active':
      dbStatus = 'ACTIVE';
      break;
    case 'past_due':
      dbStatus = 'PAST_DUE';
      break;
    case 'canceled':
    case 'cancelled':
      dbStatus = 'CANCELLED';
      break;
    case 'unpaid':
    case 'incomplete_expired':
      dbStatus = 'INACTIVE';
      break;
    default:
      dbStatus = 'ACTIVE';
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      subscriptionStatus: dbStatus,
      ...(currentPeriodEnd ? { subscriptionEndDate: new Date(currentPeriodEnd * 1000) } : {}),
    },
  });

  console.log(`[stripe:subscription.updated] Company ${company.id} status → ${dbStatus}`);
}

async function handleSubscriptionDeleted(event: Record<string, unknown>) {
  const subscription = event.data as Record<string, unknown>;
  const obj = subscription.object as Record<string, unknown>;
  const subscriptionId = obj.id as string;

  console.log('[stripe:subscription.deleted]', { subscriptionId });

  const company = await prisma.company.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!company) {
    console.error(`[stripe:subscription.deleted] No company found for subscription ${subscriptionId}`);
    return;
  }

  // Mark subscription as cancelled and downgrade to SOLO
  await prisma.company.update({
    where: { id: company.id },
    data: {
      subscriptionStatus: 'CANCELLED',
      subscriptionPlan: 'SOLO',
      stripeSubscriptionId: null,
    },
  });

  console.log(`[stripe:subscription.deleted] Company ${company.id} downgraded to SOLO and cancelled`);
}

// ─── POST Handler ─────────────────────────────────────────────────

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
