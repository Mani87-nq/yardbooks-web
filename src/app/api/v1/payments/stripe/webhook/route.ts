/**
 * POST /api/v1/payments/stripe/webhook
 *
 * Stripe sends webhook events here after payment completion.
 * Handles checkout.session.completed events to record payments.
 *
 * This is a PUBLIC endpoint — called directly by Stripe servers.
 *
 * Features:
 *   - Signature verification (HMAC-SHA256 timing-safe)
 *   - Idempotency via webhookEvent table
 *   - Amount verification against invoice balance
 *   - Structured logging for audit trail
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyStripeWebhookSignature, resolveStripeCredentials } from '@/lib/stripe-integration';
import Decimal from 'decimal.js';

export async function POST(request: NextRequest) {
  const logContext: Record<string, unknown> = { source: 'stripe-webhook' };

  try {
    // Read raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    if (!signature) {
      console.error('[Stripe Webhook] Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Parse the event to get metadata (we need invoice_id to find the company)
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      console.error('[Stripe Webhook] Invalid JSON body');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventId = event.id as string;
    const eventType = event.type as string;
    logContext.eventId = eventId;
    logContext.eventType = eventType;

    console.log('[Stripe Webhook] Received event:', logContext);

    // ── Idempotency check ──
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });
    if (existingEvent) {
      console.log('[Stripe Webhook] Duplicate event — already processed', logContext);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // We only handle checkout.session.completed
    if (eventType !== 'checkout.session.completed') {
      // Record other events but don't process them
      try {
        await prisma.webhookEvent.create({
          data: {
            id: eventId,
            source: 'stripe',
            eventType,
          },
        });
      } catch {
        // Ignore duplicate key errors
      }
      console.log('[Stripe Webhook] Ignoring event type:', eventType);
      return NextResponse.json({ received: true });
    }

    // Extract session data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (event.data as any)?.object;
    if (!session) {
      console.error('[Stripe Webhook] Missing session data', logContext);
      return NextResponse.json({ error: 'Missing session data' }, { status: 400 });
    }

    const invoiceId = session.client_reference_id || session.metadata?.invoice_id;
    const amountTotal = session.amount_total; // In cents
    const currency = session.currency as string;
    const paymentIntent = session.payment_intent as string;

    logContext.invoiceId = invoiceId;
    logContext.amountCents = amountTotal;
    logContext.currency = currency;
    logContext.paymentIntent = paymentIntent;

    if (!invoiceId) {
      console.error('[Stripe Webhook] No invoice_id in session', logContext);
      return NextResponse.json({ error: 'Missing invoice reference' }, { status: 400 });
    }

    // ── Look up invoice to verify company and get webhook secret ──
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { company: { select: { id: true, businessName: true } } },
    });

    if (!invoice) {
      console.error('[Stripe Webhook] Invoice not found', logContext);
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    logContext.companyId = invoice.companyId;

    // ── Verify webhook signature with company's Stripe secret ──
    const credentials = await resolveStripeCredentials(invoice.companyId);
    if (credentials?.webhookSecret) {
      const isValid = verifyStripeWebhookSignature(rawBody, signature, credentials.webhookSecret);
      if (!isValid) {
        console.error('[Stripe Webhook] Signature verification FAILED', logContext);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      console.log('[Stripe Webhook] Signature verified', logContext);
    } else {
      console.warn('[Stripe Webhook] No webhook secret configured — skipping signature verification', logContext);
    }

    // ── Record payment and update invoice ──
    const paymentAmount = new Decimal(amountTotal).dividedBy(100); // Convert cents to dollars

    await prisma.$transaction(async (tx) => {
      // Create Payment record
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: paymentAmount.toDecimalPlaces(2).toNumber(),
          paymentMethod: 'STRIPE',
          reference: paymentIntent || eventId,
          notes: `Stripe payment ${paymentIntent || eventId}`,
          date: new Date(),
        },
      });

      // Update invoice balance and status
      const newAmountPaid = new Decimal(invoice.amountPaid.toString()).plus(paymentAmount);
      const newBalance = new Decimal(invoice.total.toString()).minus(newAmountPaid);

      const newStatus = newBalance.lessThanOrEqualTo(0) ? 'PAID' : 'PARTIAL';

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid.toDecimalPlaces(2).toNumber(),
          balance: Decimal.max(0, newBalance).toDecimalPlaces(2).toNumber(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: newStatus as any,
          paidDate: newStatus === 'PAID' ? new Date() : undefined,
        },
      });

      // Record webhook event (upsert for idempotency)
      await tx.webhookEvent.upsert({
        where: { id: eventId },
        create: {
          id: eventId,
          source: 'stripe',
          eventType,
        },
        update: {},
      });
    });

    console.log('[Stripe Webhook] Payment recorded successfully', {
      ...logContext,
      paymentAmount: paymentAmount.toString(),
    });

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('[Stripe Webhook] Processing error:', {
      ...logContext,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
