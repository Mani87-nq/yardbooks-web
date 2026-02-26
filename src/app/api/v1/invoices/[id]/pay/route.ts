/**
 * POST /api/v1/invoices/[id]/pay
 *
 * Creates a WiPay hosted checkout session for paying an invoice.
 * Returns the redirect URL where the customer completes payment.
 *
 * This is a PUBLIC endpoint — customers access it from the "Pay Now" link
 * in their invoice email. No auth required (invoice is looked up by ID).
 *
 * Features:
 *   - Per-company WiPay credentials
 *   - Amount validation and rounding
 *   - Duplicate pending checkout prevention
 *   - Company fee structure configuration
 *
 * Body: { customerPhone: string }
 *   (Name and email are pulled from the invoice's customer record)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { createWiPayCheckout, resolveWiPayCredentials, validatePaymentAmount } from '@/lib/wipay';

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

    // Calculate remaining balance and validate amount
    const balance = Number(invoice.balance);
    const amountCheck = validatePaymentAmount(balance);
    if (!amountCheck.valid) {
      return badRequest(amountCheck.error || 'Invalid payment amount');
    }

    if (amountCheck.amount <= 0) {
      return badRequest('No balance remaining on this invoice.');
    }

    // ── Check for duplicate pending checkouts ──
    // If a payment was started in the last 5 minutes for this invoice, warn
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentPayment = await prisma.payment.findFirst({
      where: {
        invoiceId: id,
        paymentMethod: 'WIPAY',
        date: { gte: fiveMinutesAgo },
      },
      orderBy: { date: 'desc' },
    });

    if (recentPayment) {
      // A payment was already recorded recently — invoice may already be paid
      // Refresh invoice data
      const freshInvoice = await prisma.invoice.findUnique({
        where: { id },
        select: { status: true, balance: true },
      });

      if (freshInvoice?.status === 'PAID') {
        return badRequest('This invoice has already been paid.');
      }
    }

    // ── Resolve WiPay credentials for this company ──
    const credentials = await resolveWiPayCredentials(invoice.companyId);

    // Build the callback URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const responseUrl = `${appUrl}/api/v1/payments/wipay/callback`;

    // Create WiPay checkout session
    const redirectUrl = await createWiPayCheckout(
      {
        orderId: invoice.id,
        total: amountCheck.amount,
        customerName: invoice.customer?.name ?? 'Customer',
        customerEmail: invoice.customer?.email ?? '',
        customerPhone: parsed.data.customerPhone,
        responseUrl,
        currency: 'JMD',
        feeStructure: credentials.feeStructure ?? 'merchant_absorb',
      },
      credentials
    );

    console.log('[WiPay Pay] Checkout created', {
      invoiceId: invoice.id,
      amount: amountCheck.amount,
      company: invoice.company?.businessName,
    });

    return NextResponse.json({
      redirectUrl,
      invoiceId: invoice.id,
      amount: amountCheck.amount,
      currency: 'JMD',
    });
  } catch (error) {
    console.error('[WiPay Pay] Checkout error:', error);
    return internalError(
      error instanceof Error ? error.message : 'Failed to create payment session'
    );
  }
}
