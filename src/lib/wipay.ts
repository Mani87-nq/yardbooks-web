/**
 * WiPay Payment Gateway v1.0.8 — Jamaica (JMD) integration.
 *
 * WiPay is a Caribbean-native payment processor that supports JMD transactions.
 * This module handles:
 *   1. Creating hosted checkout redirects for invoice payments
 *   2. Verifying callback hashes to prevent tampering
 *
 * Flow:
 *   Server POST -> WiPay API -> redirect URL -> customer pays on WiPay page
 *   -> WiPay sends callback to our response_url with status + hash
 *
 * Environment variables required:
 *   WIPAY_ACCOUNT_NUMBER  -- Merchant account number from WiPay dashboard
 *   WIPAY_API_KEY         -- Merchant key for hash verification
 *   WIPAY_ENVIRONMENT     -- "sandbox" | "live" (defaults to "sandbox")
 *   WIPAY_ORIGIN          -- Merchant website URL (e.g. "https://yaadbooks.com")
 */

import { createHash } from 'crypto';

// -- Configuration -----------------------------------------------------------

const WIPAY_ENV = process.env.WIPAY_ENVIRONMENT ?? 'sandbox';

/**
 * WiPay API v1.0.8 uses a single endpoint for both sandbox and live.
 * The `environment` parameter in the request body controls which mode is used.
 */
const WIPAY_API_URL = 'https://jm.wipayfinancial.com/plugins/payments/request';

function getRequiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

// -- Types -------------------------------------------------------------------

/** Fee structure options (WiPay API v1.0.8 uses string values). */
export type WiPayFeeStructure = 'customer_pay' | 'merchant_absorb' | 'split';

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
  /** URL WiPay sends callback to after payment */
  responseUrl: string;
  /** Reference/order data string (optional, defaults to orderId) */
  data?: string;
  /** Currency code (defaults to JMD) */
  currency?: 'JMD' | 'USD';
  /**
   * Who pays the processing fee:
   *   "customer_pay"    -- Customer pays processing fee
   *   "merchant_absorb" -- Merchant absorbs fee
   *   "split"           -- Fee split between merchant and customer
   */
  feeStructure?: WiPayFeeStructure;
  /** Address verification (0 or 1, defaults to 0) */
  avs?: 0 | 1;
}

export interface WiPayCallbackData {
  status: string;           // "success" | "failed"
  transaction_id: string;   // WiPay's transaction ID (e.g., "100-1-4398-20170108100202")
  hash: string;             // MD5(transaction_id + total + API_Key)
  total: string;            // Amount charged
  reasonCode: string;       // Numeric reason code
  message: string;          // Description message
}

// -- Public API --------------------------------------------------------------

/**
 * Create a WiPay hosted checkout session.
 * Returns the URL to redirect the customer to for payment.
 */
export async function createWiPayCheckout(params: WiPayCheckoutParams): Promise<string> {
  const accountNumber = getRequiredEnv('WIPAY_ACCOUNT_NUMBER');
  const origin = getRequiredEnv('WIPAY_ORIGIN');

  const formData = new URLSearchParams({
    account_number: accountNumber,
    avs: String(params.avs ?? 0),
    country_code: 'JM',
    currency: params.currency ?? 'JMD',
    data: params.data ?? params.orderId,
    environment: WIPAY_ENV,
    fee_structure: params.feeStructure ?? 'merchant_absorb',
    method: 'credit_card',
    order_id: params.orderId,
    origin,
    response_url: params.responseUrl,
    total: params.total.toFixed(2),
  });

  const response = await fetch(WIPAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: formData.toString(),
    redirect: 'manual', // Don't follow the redirect -- we need the URL
  });

  // WiPay may return a 302 redirect to the payment page
  const redirectUrl = response.headers.get('location');

  if (redirectUrl) {
    return redirectUrl;
  }

  // WiPay v1.0.8 may return the URL in a JSON response body
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
 *
 * WiPay API v1.0.8 hash algorithm: MD5(transaction_id + total + API_Key)
 * NOTE: Previous versions incorrectly used order_id; the correct field is transaction_id.
 */
export function verifyWiPayCallback(data: WiPayCallbackData): boolean {
  const apiKey = getRequiredEnv('WIPAY_API_KEY');

  const expectedHash = createHash('md5')
    .update(data.transaction_id + data.total + apiKey)
    .digest('hex');

  return expectedHash === data.hash;
}

/**
 * Check if a WiPay callback indicates a successful payment.
 *
 * WiPay API v1.0.8 returns:
 *   status: "success" | "failed"
 */
export function isWiPayPaymentSuccessful(data: WiPayCallbackData): boolean {
  return data.status === 'success';
}
