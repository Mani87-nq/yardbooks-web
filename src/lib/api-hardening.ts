/**
 * API Hardening Utilities
 *
 * Provides defence-in-depth for all API routes:
 *   - Idempotency keys  (in-memory cache, swap for Redis later)
 *   - Error sanitization (no stack traces in production)
 *   - PII scrubbing      (mask emails, phones, SSNs in logs)
 *   - Request size limits (default 100 KB)
 *
 * Usage:
 *   import {
 *     withIdempotency,
 *     sanitizeError,
 *     scrubPII,
 *     validateRequestSize,
 *   } from '@/lib/api-hardening';
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================
// 1. IDEMPOTENCY KEY SYSTEM
// ============================================

interface CachedEntry {
  response: unknown;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** In-memory idempotency store. Replace with Redis when available. */
const idempotencyCache = new Map<string, CachedEntry>();

/** Counter for triggering periodic cleanup */
let operationCount = 0;
const CLEANUP_INTERVAL = 100;

/**
 * Remove expired entries from the cache.
 * Called automatically every CLEANUP_INTERVAL operations.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  idempotencyCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      idempotencyCache.delete(key);
    }
  });
}

/**
 * Check whether an idempotency key already exists in the cache.
 *
 * @returns `{ duplicate: true, cachedResponse }` when the key was seen before
 *          and has not expired, otherwise `{ duplicate: false }`.
 */
export function checkIdempotencyKey(
  key: string,
): { duplicate: boolean; cachedResponse?: unknown } {
  const entry = idempotencyCache.get(key);
  if (!entry) return { duplicate: false };

  if (entry.expiresAt <= Date.now()) {
    idempotencyCache.delete(key);
    return { duplicate: false };
  }

  return { duplicate: true, cachedResponse: entry.response };
}

/**
 * Store a response against an idempotency key.
 *
 * @param key     The idempotency key (usually from the request header).
 * @param response  The response body to cache.
 * @param ttlMs   Time-to-live in milliseconds (default 24 h).
 */
export function storeIdempotencyKey(
  key: string,
  response: unknown,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  idempotencyCache.set(key, {
    response,
    expiresAt: Date.now() + ttlMs,
  });

  // Periodic cleanup
  operationCount++;
  if (operationCount >= CLEANUP_INTERVAL) {
    operationCount = 0;
    cleanupExpiredEntries();
  }
}

/**
 * Idempotency wrapper for API route handlers.
 *
 * Reads the `Idempotency-Key` header. If the key has been seen before and the
 * cached entry is still valid, the cached response is returned immediately
 * (HTTP 200). If the header is absent the handler runs without idempotency
 * tracking.
 *
 * @example
 *   export async function POST(request: NextRequest) {
 *     return withIdempotency(request, async () => {
 *       // ... create resource ...
 *       return NextResponse.json(resource, { status: 201 });
 *     });
 *   }
 */
export async function withIdempotency(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const idempotencyKey = request.headers.get('Idempotency-Key');

  // No key header: skip idempotency, just run the handler
  if (!idempotencyKey) {
    return handler();
  }

  // Check for a cached response
  const cached = checkIdempotencyKey(idempotencyKey);
  if (cached.duplicate) {
    return NextResponse.json(cached.cachedResponse, { status: 200 });
  }

  // Execute the handler
  const response = await handler();

  // Cache the response body for future duplicate requests.
  // Clone the response so we can read the body without consuming it.
  try {
    const cloned = response.clone();
    const body = await cloned.json();
    storeIdempotencyKey(idempotencyKey, body);
  } catch {
    // If the response is not JSON (e.g. 204 No Content) we still cache a
    // minimal marker so duplicates are detected.
    storeIdempotencyKey(idempotencyKey, null);
  }

  return response;
}

// ============================================
// 2. ERROR SANITIZATION
// ============================================

/**
 * Sanitize an error for safe client-facing responses.
 *
 * In production every error is reduced to a generic message so that stack
 * traces, database details, and file paths are never leaked.
 *
 * In development the full message is passed through for easier debugging.
 */
export function sanitizeError(error: unknown): { message: string; code?: string } {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    return { message: 'Internal server error' };
  }

  // Development: surface useful details
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as Error & { code?: string }).code,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: String(error) };
}

// ============================================
// 3. PII SCRUBBING
// ============================================

/**
 * Field names whose values must always be fully redacted.
 * Case-insensitive matching is handled by lowering the key before lookup.
 */
const REDACTED_FIELDS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'secret',
  'twofactorsecret',
  'pin',
  'ssn',
  'trn',
  'creditcard',
]);

/** Matches most common email patterns. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Matches phone numbers with or without country code: +1-234-567-8901, 234-567-8901, (234) 567-8901, etc. */
const PHONE_REGEX = /^[\+]?[\d\s\-().]{7,20}$/;

/** Matches SSN / TRN patterns: 123-45-6789, 123-456-789, etc. */
const SSN_TRN_REGEX = /^\d{3}[- ]?\d{2,3}[- ]?\d{3,4}$/;

/**
 * Mask an email address, keeping the first character and domain.
 * `john@example.com` -> `j***@example.com`
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  return `${local[0]}***@${domain}`;
}

/**
 * Mask a phone number, keeping only the last four digits.
 * `+1-234-567-8901` -> `***-***-8901`
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Mask an SSN/TRN pattern, keeping only the last segment.
 * `123-45-6789` -> `***-***-6789`
 */
function maskSSN(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 3) return '***-***-XXX';
  const lastSegment = digits.slice(-Math.min(4, digits.length));
  return `***-***-${lastSegment}`;
}

/**
 * Recursively scrub PII from a data object.
 *
 * - Fields in `REDACTED_FIELDS` are replaced with `'[REDACTED]'`.
 * - String values that look like emails, phones, or SSNs are masked.
 * - Nested objects and arrays are processed recursively.
 * - Other values are passed through unchanged.
 */
export function scrubPII(data: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Fully redact known-sensitive field names
    if (REDACTED_FIELDS.has(key.toLowerCase())) {
      scrubbed[key] = '[REDACTED]';
      continue;
    }

    // Recurse into nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      scrubbed[key] = scrubPII(value as Record<string, unknown>);
      continue;
    }

    // Recurse into arrays
    if (Array.isArray(value)) {
      scrubbed[key] = value.map((item) => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          return scrubPII(item as Record<string, unknown>);
        }
        if (typeof item === 'string') {
          return scrubStringValue(item);
        }
        return item;
      });
      continue;
    }

    // Mask string values that look like PII
    if (typeof value === 'string') {
      scrubbed[key] = scrubStringValue(value);
      continue;
    }

    // Pass through everything else (numbers, booleans, null, etc.)
    scrubbed[key] = value;
  }

  return scrubbed;
}

/**
 * Apply PII masking heuristics to a single string value.
 */
function scrubStringValue(value: string): string {
  if (EMAIL_REGEX.test(value)) return maskEmail(value);
  if (SSN_TRN_REGEX.test(value)) return maskSSN(value);
  if (PHONE_REGEX.test(value)) return maskPhone(value);
  return value;
}

// ============================================
// 4. REQUEST SIZE VALIDATION
// ============================================

const DEFAULT_MAX_BYTES = 102_400; // 100 KB

/**
 * Validate that a request body does not exceed the allowed size.
 *
 * Checks the `Content-Length` header. If the header is absent the request is
 * assumed to be within limits (the body will still be bounded by the runtime).
 *
 * @param request   The incoming Next.js request.
 * @param maxBytes  Maximum allowed body size in bytes (default 100 KB).
 * @returns `{ valid: true }` when acceptable, or `{ valid: false, size }` when
 *          the declared content length exceeds the limit.
 */
export function validateRequestSize(
  request: NextRequest,
  maxBytes: number = DEFAULT_MAX_BYTES,
): { valid: boolean; size?: number } {
  const contentLength = request.headers.get('content-length');

  if (!contentLength) {
    // No Content-Length header: assume OK (runtime will enforce its own limit)
    return { valid: true };
  }

  const size = parseInt(contentLength, 10);

  if (isNaN(size)) {
    return { valid: true };
  }

  if (size > maxBytes) {
    return { valid: false, size };
  }

  return { valid: true, size };
}
