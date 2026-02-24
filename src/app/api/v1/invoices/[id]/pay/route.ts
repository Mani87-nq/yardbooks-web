/**
 * POST /api/v1/invoices/[id]/pay
 *
 * Creates a WiPay hosted checkout session for paying an invoice.
 * Returns the redirect URL where the customer completes payment.
 *
 * This is a PUBLIC endpoint — customers access it from the "Pay Now" link
 * in their invoice email. No auth required (invoice is looked up by ID).
 *
 * Body: { customerPhone: string }
 *   (Name and email are pulled from the invoice's customer record)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { createWiPayCheckout } from '@/lib/wipay';

type RouteContext = { params: Promise<{ id: string }> };

const paySchema = z.object({
  customerPhone: z.string().min(7).max(20),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Validate request body
    const body = await request.json();
    const parsed = paySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('A valid phone number is required to process payment.');
    }

    // Look up the invoice with customer details
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        company: { select: { businessName: true } },
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
    const balance = Number(invoice.balance);
    if (balance <= 0) {
      return badRequest('No balance remaining on this invoice.');
    }

    // Build the callback URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const returnUrl = `${appUrl}/api/v1/payments/wipay/callback`;

    // Create WiPay checkout session
    const redirectUrl = await createWiPayCheckout({
      orderId: invoice.id,
      total: balance,
      customerName: invoice.customer?.name ?? 'Customer',
      customerEmail: invoice.customer?.email ?? '',
      customerPhone: parsed.data.customerPhone,
      returnUrl,
      currency: 'JMD',
      feeStructure: 2, // Merchant absorbs fees
    });

    return NextResponse.json({
      redirectUrl,
      invoiceId: invoice.id,
      amount: balance,
      currency: 'JMD',
    });
  } catch (error) {
    console.error('WiPay checkout error:', error);
    return internalError(
      error instanceof Error ? error.message : 'Failed to create payment session'
    );
  }
}
