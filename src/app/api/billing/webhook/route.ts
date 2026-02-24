import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/db';

// Stripe webhook handler for subscription events
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Verify Stripe signature (HMAC-SHA256)
  let event;
  try {
    event = verifyStripeSignature(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ── Idempotency check ──────────────────────────────────────────────
  // Stripe may deliver the same event multiple times. We track each
  // event ID so duplicate deliveries are safely ignored.
  const eventId: string | undefined = event.id;
  if (eventId) {
    const existing = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
    if (existing) {
      // Already processed — acknowledge without re-processing
      console.log(`Duplicate webhook event ignored: ${eventId}`);
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { companyId, userId, planId } = session.metadata || {};
        if (companyId && planId) {
          await prisma.company.update({
            where: { id: companyId },
            data: {
              subscriptionPlan: planId.toUpperCase() as any,
              subscriptionStatus: 'ACTIVE',
              stripeCustomerId: session.customer ?? null,
              stripeSubscriptionId: session.subscription ?? null,
              subscriptionEndDate: session.subscription
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // ~30 days
                : null,
            },
          });
          console.log(`Checkout completed - Company: ${companyId}, Plan: ${planId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const company = await prisma.company.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (company) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              subscriptionStatus: mapStripeStatus(subscription.status),
              subscriptionEndDate: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
            },
          });
          console.log(`Subscription updated - Company: ${company.id}, Status: ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const company = await prisma.company.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (company) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              subscriptionStatus: 'CANCELLED' as const,
              subscriptionPlan: 'SOLO' as const,
            },
          });
          console.log(`Subscription cancelled - Company: ${company.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const company = await prisma.company.findFirst({
          where: { stripeCustomerId: invoice.customer },
        });
        if (company) {
          await prisma.company.update({
            where: { id: company.id },
            data: { subscriptionStatus: 'PAST_DUE' },
          });
          console.log(`Payment failed - Company: ${company.id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // ── Record event as processed ──────────────────────────────────────
    if (eventId) {
      await prisma.webhookEvent.create({
        data: { id: eventId, source: 'stripe', eventType: event.type },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

function mapStripeStatus(stripeStatus: string): 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INACTIVE' {
  switch (stripeStatus) {
    case 'active': return 'ACTIVE';
    case 'past_due': return 'PAST_DUE';
    case 'canceled': return 'CANCELLED';
    case 'unpaid': return 'PAST_DUE';
    case 'trialing': return 'TRIALING';
    default: return 'ACTIVE';
  }
}

function verifyStripeSignature(payload: string, header: string, secret: string): any {
  const parts = header.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    throw new Error('Invalid signature header format');
  }

  const timestamp = timestampPart.slice(2);
  const expectedSig = signaturePart.slice(3);

  // Reject events older than 5 minutes (replay attack prevention)
  const tolerance = 300; // 5 minutes
  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (timestampAge > tolerance) {
    throw new Error('Timestamp too old');
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const computedSig = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Timing-safe comparison
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(computedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Signature mismatch');
  }

  return JSON.parse(payload);
}
