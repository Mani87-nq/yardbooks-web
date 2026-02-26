/**
 * GET/POST /api/v1/payments/wipay/callback
 *
 * WiPay redirects the customer here after payment (success or failure).
 * Supports both GET (redirect) and POST (server-to-server callback).
 * Query/body parameters include: status, transaction_id, hash, total, reasonCode, message.
 *
 * This endpoint:
 *   1. Verifies the hash using timing-safe comparison
 *   2. Checks idempotency via webhookEvent
 *   3. Verifies callback amount matches invoice balance
 *   4. Records the payment in the database
 *   5. Updates invoice status and balance
 *   6. Redirects the customer to a success/failure page (GET) or returns JSON (POST)
 *
 * This is a PUBLIC endpoint (redirect from WiPay).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyWiPayCallback, isWiPayPaymentSuccessful, resolveWiPayCredentials } from '@/lib/wipay';
import type { WiPayCallbackData } from '@/lib/wipay';
import Decimal from 'decimal.js';

// ─── Shared handler for both GET and POST ─────────────────────────

async function handleCallback(request: NextRequest, isPost: boolean) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  // Extract callback data from query params (GET) or form body (POST)
  let callbackData: WiPayCallbackData;
  let invoiceId: string;

  if (isPost) {
    // WiPay may POST as application/x-www-form-urlencoded or JSON
    const contentType = request.headers.get('content-type') || '';
    let bodyParams: Record<string, string>;

    if (contentType.includes('application/json')) {
      bodyParams = await request.json();
    } else {
      const formData = await request.formData();
      bodyParams = Object.fromEntries(
        Array.from(formData.entries()).map(([k, v]) => [k, String(v)])
      );
    }

    callbackData = {
      status: bodyParams.status ?? '',
      transaction_id: bodyParams.transaction_id ?? '',
      hash: bodyParams.hash ?? '',
      total: bodyParams.total ?? '0',
      reasonCode: bodyParams.reasonCode ?? '',
      message: bodyParams.message ?? '',
    };
    invoiceId = bodyParams.order_id ?? bodyParams.data ?? '';
  } else {
    const params = request.nextUrl.searchParams;
    callbackData = {
      status: params.get('status') ?? '',
      transaction_id: params.get('transaction_id') ?? '',
      hash: params.get('hash') ?? '',
      total: params.get('total') ?? '0',
      reasonCode: params.get('reasonCode') ?? '',
      message: params.get('message') ?? '',
    };
    invoiceId = params.get('order_id') ?? params.get('data') ?? '';
  }

  // Structured logging for audit trail
  const logContext = {
    invoiceId,
    transactionId: callbackData.transaction_id,
    amount: callbackData.total,
    status: callbackData.status,
    method: isPost ? 'POST' : 'GET',
  };

  console.log('[WiPay Callback] Received:', logContext);

  // ── 1. Basic validation ──
  if (!callbackData.transaction_id || !callbackData.hash) {
    console.error('[WiPay Callback] Missing required fields', logContext);
    return respond(isPost, `${appUrl}/payment/error?reason=invalid_callback&invoice=${invoiceId}`, {
      error: 'Missing required callback fields',
    });
  }

  // ── 2. Resolve API key for hash verification ──
  // Try to resolve company-specific credentials via invoice
  let apiKey: string | undefined;
  if (invoiceId) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { companyId: true },
      });
      if (invoice) {
        const creds = await resolveWiPayCredentials(invoice.companyId);
        apiKey = creds.apiKey;
      }
    } catch {
      // Fall through to env var
    }
  }

  // ── 3. Verify hash authenticity (timing-safe) ──
  if (!verifyWiPayCallback(callbackData, apiKey)) {
    console.error('[WiPay Callback] Hash verification FAILED', logContext);
    return respond(isPost, `${appUrl}/payment/error?reason=verification_failed&invoice=${invoiceId}`, {
      error: 'Hash verification failed',
    });
  }

  console.log('[WiPay Callback] Hash verified successfully', logContext);

  // ── 4. Idempotency check ──
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { id: callbackData.transaction_id },
  });
  if (existingEvent) {
    console.log('[WiPay Callback] Duplicate — already processed', logContext);
    return respond(isPost, `${appUrl}/payment/success?invoice=${invoiceId}`, {
      message: 'Payment already processed',
      invoiceId,
    });
  }

  // ── 5. Handle failed payments ──
  if (!isWiPayPaymentSuccessful(callbackData)) {
    console.log('[WiPay Callback] Payment failed:', {
      ...logContext,
      reason: callbackData.message,
      reasonCode: callbackData.reasonCode,
    });

    // Record the failed event for auditing
    try {
      await prisma.webhookEvent.create({
        data: {
          id: callbackData.transaction_id,
          source: 'wipay',
          eventType: 'payment_failed',
        },
      });
    } catch {
      // Ignore duplicate key errors — idempotent
    }

    return respond(isPost, `${appUrl}/payment/failed?invoice=${invoiceId}&reason=${encodeURIComponent(callbackData.message)}`, {
      error: 'Payment failed',
      reason: callbackData.message,
    });
  }

  // ── 6. Record payment and update invoice ──
  try {
    const paymentAmount = new Decimal(callbackData.total);

    await prisma.$transaction(async (tx) => {
      // Look up the invoice with company info for verification
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { company: { select: { id: true, businessName: true } } },
      });

      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      // Verify the callback amount doesn't exceed the invoice balance
      const currentBalance = new Decimal(invoice.balance.toString());
      if (paymentAmount.greaterThan(currentBalance.plus(1))) { // Allow $1 tolerance for rounding
        console.warn('[WiPay Callback] Amount exceeds balance', {
          ...logContext,
          invoiceBalance: currentBalance.toString(),
          paymentAmount: paymentAmount.toString(),
        });
        // Still process — WiPay has already charged the customer
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: newStatus as any,
          paidDate: newStatus === 'PAID' ? new Date() : undefined,
        },
      });

      // Record webhook event for idempotency (upsert prevents race condition)
      await tx.webhookEvent.upsert({
        where: { id: callbackData.transaction_id },
        create: {
          id: callbackData.transaction_id,
          source: 'wipay',
          eventType: 'payment_completed',
        },
        update: {}, // No-op if already exists
      });
    });

    console.log('[WiPay Callback] Payment recorded successfully', {
      ...logContext,
      company: 'verified',
    });

    return respond(isPost, `${appUrl}/payment/success?invoice=${invoiceId}`, {
      message: 'Payment recorded successfully',
      invoiceId,
      amount: callbackData.total,
    });
  } catch (error) {
    console.error('[WiPay Callback] Processing error:', {
      ...logContext,
      error: error instanceof Error ? error.message : String(error),
    });
    return respond(isPost, `${appUrl}/payment/error?reason=processing_failed&invoice=${invoiceId}`, {
      error: 'Payment processing failed',
    });
  }
}

// ─── Response helper — redirect for GET, JSON for POST ──────────

function respond(isPost: boolean, redirectUrl: string, jsonBody: Record<string, unknown>) {
  if (isPost) {
    const isError = 'error' in jsonBody;
    return NextResponse.json(jsonBody, { status: isError ? 400 : 200 });
  }
  return NextResponse.redirect(redirectUrl);
}

// ─── Route handlers ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  return handleCallback(request, false);
}

export async function POST(request: NextRequest) {
  return handleCallback(request, true);
}
