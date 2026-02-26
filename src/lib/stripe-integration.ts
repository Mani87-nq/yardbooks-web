/**
 * Stripe Payment Integration
 *
 * Handles Stripe Checkout Sessions for invoice payments.
 * Uses per-company Stripe credentials from integrationSettings.
 *
 * Flow:
 *   1. Customer clicks "Pay with Card" on invoice
 *   2. Server creates Stripe Checkout Session
 *   3. Customer redirected to Stripe-hosted payment page
 *   4. Stripe webhook callback records payment + updates invoice
 */

import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption';

// ─── Types ──────────────────────────────────────────────────────

export interface StripeCredentials {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  enabled: boolean;
}

export interface StripeCheckoutParams {
  /** Invoice ID used as client_reference_id */
  invoiceId: string;
  /** Payment amount in JMD (smallest unit will be calculated) */
  amount: number;
  /** Currency code */
  currency: 'jmd' | 'usd';
  /** Customer email for Stripe receipt */
  customerEmail: string;
  /** Customer name */
  customerName: string;
  /** Description shown on Stripe checkout */
  description: string;
  /** URL to redirect after successful payment */
  successUrl: string;
  /** URL to redirect after cancelled payment */
  cancelUrl: string;
  /** Company name for statement descriptor */
  companyName?: string;
}

// ─── Credential Resolution ──────────────────────────────────────

/**
 * Resolve Stripe credentials for a company.
 * Returns null if Stripe is not configured.
 */
export async function resolveStripeCredentials(companyId: string): Promise<StripeCredentials | null> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { integrationSettings: true },
    });

    const settings = company?.integrationSettings as Record<string, unknown> | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeSettings = settings?.stripe as any;

    if (!stripeSettings?.secretKey || !stripeSettings?.enabled) {
      return null;
    }

    return {
      publishableKey: stripeSettings.publishableKey || '',
      secretKey: decrypt(stripeSettings.secretKey),
      webhookSecret: stripeSettings.webhookSecret ? decrypt(stripeSettings.webhookSecret) : '',
      enabled: stripeSettings.enabled,
    };
  } catch (error) {
    console.error(`[Stripe] Failed to resolve credentials for company ${companyId}:`, error);
    return null;
  }
}

// ─── Checkout Session ───────────────────────────────────────────

/**
 * Create a Stripe Checkout Session for an invoice payment.
 * Returns the checkout URL for the customer.
 *
 * Uses the Stripe REST API directly (no SDK dependency needed).
 */
export async function createStripeCheckoutSession(
  params: StripeCheckoutParams,
  credentials: StripeCredentials
): Promise<{ url: string; sessionId: string }> {
  // Convert amount to smallest currency unit (cents for USD, cents for JMD)
  const amountInCents = Math.round(params.amount * 100);

  const body = new URLSearchParams({
    'payment_method_types[]': 'card',
    'mode': 'payment',
    'client_reference_id': params.invoiceId,
    'customer_email': params.customerEmail,
    'line_items[0][price_data][currency]': params.currency,
    'line_items[0][price_data][unit_amount]': String(amountInCents),
    'line_items[0][price_data][product_data][name]': params.description,
    'success_url': params.successUrl,
    'cancel_url': params.cancelUrl,
  });

  if (params.companyName) {
    body.append('payment_intent_data[statement_descriptor_suffix]', params.companyName.substring(0, 22));
  }

  // Add metadata for webhook processing
  body.append('metadata[invoice_id]', params.invoiceId);
  body.append('metadata[source]', 'yaadbooks');

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Stripe API error: HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.message) {
        errorMessage = `Stripe error: ${parsed.error.message}`;
      }
    } catch {
      // Use generic message
    }
    throw new Error(errorMessage);
  }

  const session = await response.json();

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}

/**
 * Verify a Stripe webhook signature.
 * Uses the raw body and signing secret to verify authenticity.
 *
 * Stripe-Signature header format:
 *   t=timestamp,v1=signature
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): boolean {
  try {
    const elements = signature.split(',');
    const timestamp = elements.find(e => e.startsWith('t='))?.split('=')[1];
    const v1Sig = elements.find(e => e.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !v1Sig) return false;

    // Check timestamp is within 5 minutes
    const eventTimestamp = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - eventTimestamp) > 300) return false;

    // Compute expected signature
    const { createHmac, timingSafeEqual } = require('crypto');
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSig = createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    // Timing-safe comparison
    const expected = Buffer.from(expectedSig, 'utf8');
    const received = Buffer.from(v1Sig, 'utf8');

    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
