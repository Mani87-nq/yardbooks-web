/**
 * GET /api/v1/payments/wipay/callback
 *
 * WiPay redirects the customer here after payment (success or failure).
 * Query parameters include: status, transaction_id, hash, total, reasonCode, message.
 *
 * This endpoint:
 *   1. Verifies the hash (MD5(transaction_id + total + API_Key))
 *   2. Records the payment in the database
 *   3. Updates invoice status and balance
 *   4. Redirects the customer to a success/failure page
 *
 * This is a PUBLIC endpoint (redirect from WiPay).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyWiPayCallback, isWiPayPaymentSuccessful } from '@/lib/wipay';
import type { WiPayCallbackData } from '@/lib/wipay';
import Decimal from 'decimal.js';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  // Extract WiPay callback parameters (v1.0.8 field names)
  const callbackData: WiPayCallbackData = {
    status: params.get('status') ?? '',
    transaction_id: params.get('transaction_id') ?? '',
    hash: params.get('hash') ?? '',
    total: params.get('total') ?? '0',
    reasonCode: params.get('reasonCode') ?? '',
    message: params.get('message') ?? '',
  };

  // The order_id is passed through the `data` parameter we sent during checkout.
  // WiPay may return it as `order_id` or `data` in the callback query string.
  const invoiceId = params.get('order_id') ?? params.get('data') ?? '';

  // -- 1. Verify hash authenticity ----------------------------------------
  if (!verifyWiPayCallback(callbackData)) {
    console.error('WiPay callback hash verification failed', {
      transaction_id: callbackData.transaction_id,
    });
    return NextResponse.redirect(
      `${appUrl}/payment/error?reason=verification_failed&invoice=${invoiceId}`
    );
  }

  // -- 2. Idempotency -- check if we already processed this transaction ---
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { id: callbackData.transaction_id },
  });
  if (existingEvent) {
    // Already processed -- redirect to success page
    return NextResponse.redirect(
      `${appUrl}/payment/success?invoice=${invoiceId}`
    );
  }

  // -- 3. Handle payment result -------------------------------------------
  if (!isWiPayPaymentSuccessful(callbackData)) {
    console.log('WiPay payment failed:', {
      transaction_id: callbackData.transaction_id,
      reason: callbackData.message,
    });
    return NextResponse.redirect(
      `${appUrl}/payment/failed?invoice=${invoiceId}&reason=${encodeURIComponent(callbackData.message)}`
    );
  }

  // -- 4. Record payment and update invoice -------------------------------
  try {
    const paymentAmount = new Decimal(callbackData.total);

    await prisma.$transaction(async (tx) => {
      // Look up the invoice
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      // Create Payment record
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: paymentAmount.toDecimalPlaces(2).toNumber(),
          paymentMethod: 'WIPAY',
          reference: callbackData.transaction_id,
          notes: `WiPay transaction ${callbackData.transaction_id}`,
          date: new Date(),
        },
      });

      // Update invoice balance and status
      const newAmountPaid = new Decimal(invoice.amountPaid.toString()).plus(paymentAmount);
      const newBalance = new Decimal(invoice.total.toString()).minus(newAmountPaid);

      const newStatus = newBalance.lessThanOrEqualTo(0)
        ? 'PAID'
        : 'PARTIAL';

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid.toDecimalPlaces(2).toNumber(),
          balance: Decimal.max(0, newBalance).toDecimalPlaces(2).toNumber(),
          status: newStatus as any,
          paidDate: newStatus === 'PAID' ? new Date() : undefined,
        },
      });

      // Record webhook event for idempotency
      await tx.webhookEvent.create({
        data: {
          id: callbackData.transaction_id,
          source: 'wipay',
          eventType: 'payment_completed',
        },
      });
    });

    console.log(`WiPay payment recorded - Invoice: ${invoiceId}, Amount: ${callbackData.total} JMD`);

    return NextResponse.redirect(
      `${appUrl}/payment/success?invoice=${invoiceId}`
    );
  } catch (error) {
    console.error('WiPay callback processing error:', error);
    return NextResponse.redirect(
      `${appUrl}/payment/error?reason=processing_failed&invoice=${invoiceId}`
    );
  }
}
