/**
 * WiPay Payment Gateway — Jamaica (JMD) integration.
 *
 * WiPay is a Caribbean-native payment processor that supports JMD transactions.
 * This module handles:
 *   1. Creating hosted checkout redirects for invoice payments
 *   2. Verifying callback hashes to prevent tampering
 *
 * Flow:
 *   Server POST → WiPay API → redirect URL → customer pays on WiPay page
 *   → WiPay redirects back to our callback URL with status + hash
 *
 * Environment variables required:
 *   WIPAY_ACCOUNT_NUMBER  — Merchant account number from WiPay dashboard
 *   WIPAY_API_KEY         — Merchant key for hash verification
 *   WIPAY_DEVELOPER_ID    — Developer ID (use "1" for sandbox)
 *   WIPAY_ENVIRONMENT     — "sandbox" | "live" (defaults to "sandbox")
 */

import { createHash } from 'crypto';

// ── Configuration ─────────────────────────────────────────────────────────

const WIPAY_ENV = process.env.WIPAY_ENVIRONMENT ?? 'sandbox';

const API_URLS = {
  sandbox: 'https://sandbox.wipayfinancial.com/v1/gateway',
  live: 'https://wipayfinancial.com/v1/gateway_live',
} as const;

function getApiUrl(): string {
  return WIPAY_ENV === 'live' ? API_URLS.live : API_URLS.sandbox;
}

function getRequiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface WiPayCheckoutParams {
  /** Unique order/invoice identifier */
  orderId: string;
  /** Payment amount in JMD (e.g., 5000.00) */
  total: number;
  /** Customer display name */
  customerName: string;
  /** Customer email */
  customerEmail: string;
  /** Customer phone number (required by WiPay) */
  customerPhone: string;
  /** URL to redirect after payment */
  returnUrl: string;
  /** Currency code (defaults to JMD) */
  currency?: 'JMD' | 'USD';
  /**
   * Who pays the processing fee:
   *   1 = Customer pays
   *   2 = Merchant absorbs
   *   3 = Split 50/50
   */
  feeStructure?: 1 | 2 | 3;
}

export interface WiPayCallbackData {
  status: string;           // "success" | "failed"
  order_id: string;
  transaction_id: string;   // e.g., "100-1-4398-20170108100202"
  hash: string;             // MD5(order_id + total + merchant_key)
  total: string;
  reasonCode: string;       // "1" = approved, "2" = declined
  reasonDescription: string;
  name?: string;
  email?: string;
  currency?: string;
  date?: string;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Create a WiPay hosted checkout session.
 * Returns the URL to redirect the customer to for payment.
 */
export async function createWiPayCheckout(params: WiPayCheckoutParams): Promise<string> {
  const accountNumber = getRequiredEnv('WIPAY_ACCOUNT_NUMBER');
  const developerId = getRequiredEnv('WIPAY_DEVELOPER_ID');

  const formData = new URLSearchParams({
    account_number: accountNumber,
    developer_id: developerId,
    total: params.total.toFixed(2),
    currency: params.currency ?? 'JMD',
    order_id: params.orderId,
    name: params.customerName,
    email: params.customerEmail,
    phone: params.customerPhone,
    return_url: params.returnUrl,
    fee_structure: String(params.feeStructure ?? 2), // Merchant absorbs by default
    country_code: 'JM',
    environment: WIPAY_ENV,
  });

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
    redirect: 'manual', // Don't follow the redirect — we need the URL
  });

  // WiPay returns a 302 redirect to the payment page
  const redirectUrl = response.headers.get('location');

  if (redirectUrl) {
    return redirectUrl;
  }

  // Some WiPay endpoints return the URL in the response body instead
  if (response.ok) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      if (json.url) return json.url;
    } catch {
      // If it's a URL in plain text
      if (text.startsWith('http')) return text.trim();
    }
  }

  throw new Error(`WiPay checkout creation failed: HTTP ${response.status}`);
}

/**
 * Verify a WiPay callback hash to ensure the response is authentic.
 * Hash algorithm: MD5(order_id + total + merchant_key)
 */
export function verifyWiPayCallback(data: WiPayCallbackData): boolean {
  const merchantKey = getRequiredEnv('WIPAY_API_KEY');

  const expectedHash = createHash('md5')
    .update(data.order_id + data.total + merchantKey)
    .digest('hex');

  return expectedHash === data.hash;
}

/**
 * Check if a WiPay callback indicates a successful payment.
 */
export function isWiPayPaymentSuccessful(data: WiPayCallbackData): boolean {
  return data.status === 'success' && data.reasonCode === '1';
}
