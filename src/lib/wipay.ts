/**
 * WiPay Payment Gateway v1.0.8 — Jamaica (JMD) integration.
 *
 * WiPay is a Caribbean-native payment processor that supports JMD transactions.
 * This module handles:
 *   1. Creating hosted checkout redirects for invoice payments
 *   2. Verifying callback hashes to prevent tampering (timing-safe)
 *   3. Per-company credential resolution
 *
 * Flow:
 *   Server POST -> WiPay API -> redirect URL -> customer pays on WiPay page
 *   -> WiPay sends callback to our response_url with status + hash
 *
 * Environment variables (fallback when no company-level credentials):
 *   WIPAY_ACCOUNT_NUMBER  -- Merchant account number from WiPay dashboard
 *   WIPAY_API_KEY         -- Merchant key for hash verification
 *   WIPAY_ENVIRONMENT     -- "sandbox" | "live" (defaults to "sandbox")
 *   WIPAY_ORIGIN          -- Merchant website URL (e.g. "https://yaadbooks.com")
 */

import { createHash, timingSafeEqual } from 'crypto';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption';

// -- Configuration -----------------------------------------------------------

const WIPAY_API_URL = 'https://jm.wipayfinancial.com/plugins/payments/request';
const REQUEST_TIMEOUT = 30_000;   // 30 seconds
const MAX_RETRIES = 1;            // 1 retry for network errors
const RETRY_DELAY = 2_000;        // 2 second delay
const MIN_AMOUNT = 1;             // Minimum JMD amount
const MAX_AMOUNT = 10_000_000;    // Maximum JMD amount (10M)

// -- Types -------------------------------------------------------------------

/** Fee structure options (WiPay API v1.0.8 uses string values). */
export type WiPayFeeStructure = 'customer_pay' | 'merchant_absorb' | 'split';

export interface WiPayCredentials {
  accountNumber: string;
  apiKey: string;
  environment: 'sandbox' | 'live';
  origin: string;
  feeStructure?: WiPayFeeStructure;
}

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

// -- Credential Resolution ---------------------------------------------------

/**
 * Resolve WiPay credentials for a company.
 * Priority: company integrationSettings > environment variables.
 */
export async function resolveWiPayCredentials(companyId: string): Promise<WiPayCredentials> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { integrationSettings: true },
    });

    const settings = company?.integrationSettings as Record<string, unknown> | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wipaySettings = settings?.wipay as any;

    if (wipaySettings?.accountNumber && wipaySettings?.apiKey) {
      try {
        return {
          accountNumber: decrypt(wipaySettings.accountNumber),
          apiKey: decrypt(wipaySettings.apiKey),
          environment: wipaySettings.environment || 'sandbox',
          origin: wipaySettings.origin || process.env.WIPAY_ORIGIN || 'https://yaadbooks.com',
          feeStructure: wipaySettings.feeStructure || 'merchant_absorb',
        };
      } catch {
        console.error(`[WiPay] Failed to decrypt credentials for company ${companyId}`);
      }
    }
  } catch (error) {
    console.error('[WiPay] Error resolving company credentials:', error);
  }

  // Fall back to environment variables
  return {
    accountNumber: getRequiredEnv('WIPAY_ACCOUNT_NUMBER'),
    apiKey: getRequiredEnv('WIPAY_API_KEY'),
    environment: (process.env.WIPAY_ENVIRONMENT as 'sandbox' | 'live') ?? 'sandbox',
    origin: process.env.WIPAY_ORIGIN || 'https://yaadbooks.com',
    feeStructure: 'merchant_absorb',
  };
}

function getRequiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

// -- Amount Validation -------------------------------------------------------

/**
 * Validate and round a payment amount.
 */
export function validatePaymentAmount(amount: number): { valid: boolean; amount: number; error?: string } {
  if (!Number.isFinite(amount)) {
    return { valid: false, amount: 0, error: 'Invalid amount' };
  }

  // Round to 2 decimal places
  const rounded = Math.round(amount * 100) / 100;

  if (rounded < MIN_AMOUNT) {
    return { valid: false, amount: rounded, error: `Minimum payment amount is $${MIN_AMOUNT} JMD` };
  }

  if (rounded > MAX_AMOUNT) {
    return { valid: false, amount: rounded, error: `Maximum payment amount is $${MAX_AMOUNT.toLocaleString()} JMD` };
  }

  return { valid: true, amount: rounded };
}

// -- Public API --------------------------------------------------------------

/**
 * Create a WiPay hosted checkout session.
 * Returns the URL to redirect the customer to for payment.
 *
 * Features:
 * - 30s request timeout
 * - 1 retry with 2s delay for network errors
 * - Amount validation and rounding
 * - Per-company credential support
 */
export async function createWiPayCheckout(
  params: WiPayCheckoutParams,
  credentials?: WiPayCredentials
): Promise<string> {
  // Validate amount
  const amountCheck = validatePaymentAmount(params.total);
  if (!amountCheck.valid) {
    throw new Error(`WiPay amount validation failed: ${amountCheck.error}`);
  }

  const creds = credentials ?? {
    accountNumber: getRequiredEnv('WIPAY_ACCOUNT_NUMBER'),
    apiKey: getRequiredEnv('WIPAY_API_KEY'),
    environment: (process.env.WIPAY_ENVIRONMENT as 'sandbox' | 'live') ?? 'sandbox',
    origin: process.env.WIPAY_ORIGIN || 'https://yaadbooks.com',
  };

  const formData = new URLSearchParams({
    account_number: creds.accountNumber,
    avs: String(params.avs ?? 0),
    country_code: 'JM',
    currency: params.currency ?? 'JMD',
    data: params.data ?? params.orderId,
    environment: creds.environment,
    fee_structure: params.feeStructure ?? creds.feeStructure ?? 'merchant_absorb',
    method: 'credit_card',
    order_id: params.orderId,
    origin: creds.origin,
    response_url: params.responseUrl,
    total: amountCheck.amount.toFixed(2),
  });

  // Retry logic for network errors
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        console.log(`[WiPay] Retry attempt ${attempt} for order ${params.orderId}`);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await fetch(WIPAY_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: formData.toString(),
          redirect: 'manual', // Don't follow the redirect -- we need the URL
          signal: controller.signal,
        });

        clearTimeout(timeout);

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
            // Parse WiPay error responses
            if (json.error || json.message) {
              throw new Error(`WiPay error: ${json.error || json.message}`);
            }
          } catch (parseError) {
            // If it's a URL in plain text
            if (text.startsWith('http')) return text.trim();
            if (parseError instanceof Error && parseError.message.startsWith('WiPay error:')) {
              throw parseError;
            }
          }
        }

        // Non-retryable HTTP errors
        throw new Error(`WiPay checkout creation failed: HTTP ${response.status}`);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on network errors (not HTTP errors or WiPay business errors)
      const isNetworkError = lastError.name === 'AbortError' ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('ENOTFOUND') ||
        lastError.message.includes('fetch failed');

      if (!isNetworkError || attempt >= MAX_RETRIES) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('WiPay checkout creation failed');
}

/**
 * Verify a WiPay callback hash to ensure the response is authentic.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * WiPay API v1.0.8 hash algorithm: MD5(transaction_id + total + API_Key)
 */
export function verifyWiPayCallback(data: WiPayCallbackData, apiKey?: string): boolean {
  const key = apiKey ?? getRequiredEnv('WIPAY_API_KEY');

  const expectedHash = createHash('md5')
    .update(data.transaction_id + data.total + key)
    .digest('hex');

  // Timing-safe comparison prevents timing attacks
  try {
    const expected = Buffer.from(expectedHash, 'utf8');
    const received = Buffer.from(data.hash, 'utf8');

    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
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
