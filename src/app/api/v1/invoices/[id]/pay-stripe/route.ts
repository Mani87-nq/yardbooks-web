/**
 * POST /api/v1/invoices/[id]/pay-stripe
 *
 * Creates a Stripe Checkout Session for paying an invoice.
 * Returns the Stripe checkout URL where the customer completes payment.
 *
 * This is a PUBLIC endpoint — customers access it from the "Pay with Card" link.
 *
 * Body: { customerEmail?: string }
 *   (Email can be overridden; otherwise pulled from customer record)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { resolveStripeCredentials, createStripeCheckoutSession } from '@/lib/stripe-integration';

type RouteContext = { params: Promise<{ id: string }> };

const paySchema = z.object({
  customerEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Validate request body
    const body = await request.json();
    const parsed = paySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid request.');
    }

    // Look up the invoice with customer and company details
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        company: { select: { id: true, businessName: true } },
      },
    });

    if (!invoice || invoice.deletedAt) {
      return notFound('Invoice not found');
    }

    // Check invoice is payable
    if (invoice.status === 'PAID') {
      return badRequest('This invoice has already been paid.');
    }
    if (invoice.status === 'CANCELLED') {
      return badRequest('This invoice has been cancelled.');
    }
    if (invoice.status === 'DRAFT') {
      return badRequest('This invoice has not been finalized yet.');
    }

    // Calculate remaining balance
    const balance = Math.round(Number(invoice.balance) * 100) / 100;
    if (balance <= 0) {
      return badRequest('No balance remaining on this invoice.');
    }

    // ── Resolve Stripe credentials for this company ──
    const credentials = await resolveStripeCredentials(invoice.companyId);
    if (!credentials) {
      return badRequest('Stripe payments are not configured for this company. Contact the business owner.');
    }

    // Build URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const successUrl = `${appUrl}/payment/success?invoice=${invoice.id}&method=stripe`;
    const cancelUrl = `${appUrl}/payment/failed?invoice=${invoice.id}&reason=cancelled`;

    // Create Stripe Checkout Session
    const { url, sessionId } = await createStripeCheckoutSession(
      {
        invoiceId: invoice.id,
        amount: balance,
        currency: 'jmd',
        customerEmail: parsed.data?.customerEmail || invoice.customer?.email || '',
        customerName: invoice.customer?.name || 'Customer',
        description: `Invoice ${invoice.invoiceNumber} — ${invoice.company?.businessName || 'YaadBooks'}`,
        successUrl,
        cancelUrl,
        companyName: invoice.company?.businessName,
      },
      credentials
    );

    console.log('[Stripe Pay] Checkout session created', {
      invoiceId: invoice.id,
      sessionId,
      amount: balance,
      company: invoice.company?.businessName,
    });

    return NextResponse.json({
      redirectUrl: url,
      sessionId,
      invoiceId: invoice.id,
      amount: balance,
      currency: 'JMD',
    });
  } catch (error) {
    console.error('[Stripe Pay] Checkout error:', error);
    return internalError(
      error instanceof Error ? error.message : 'Failed to create Stripe payment session'
    );
  }
}
