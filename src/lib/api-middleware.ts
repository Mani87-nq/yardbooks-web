/**
 * API Middleware Enhancer
 *
 * Wraps API route handlers with common hardening patterns:
 *   - Request size validation
 *   - Error sanitization
 *   - Optional idempotency enforcement
 *
 * Usage:
 *   import { withApiHardening } from '@/lib/api-middleware';
 *
 *   const POST = withApiHardening(async (request) => {
 *     const body = await request.json();
 *     // ... business logic ...
 *     return NextResponse.json(result, { status: 201 });
 *   }, { enableIdempotency: true });
 *
 *   export { POST };
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateRequestSize,
  sanitizeError,
  withIdempotency,
} from './api-hardening';
import { internalError } from './api-error';

export interface ApiHandlerOptions {
  /** Maximum request body size in bytes. Defaults to 100 KB (102400). */
  maxRequestSize?: number;
  /** When true, the handler is wrapped with idempotency key support. */
  enableIdempotency?: boolean;
}

/**
 * Higher-order function that wraps an API route handler with hardening.
 *
 * 1. Validates request size against `Content-Length`.
 * 2. Optionally enforces idempotency via the `Idempotency-Key` header.
 * 3. Catches unhandled errors and returns a sanitized 500 response.
 *
 * @param handler  The route handler to wrap.
 * @param options  Configuration for size limits and idempotency.
 * @returns A wrapped handler with the same signature.
 */
export function withApiHardening(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options?: ApiHandlerOptions,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    // 1. Check request size
    const maxSize = options?.maxRequestSize ?? 102_400;
    const sizeCheck = validateRequestSize(request, maxSize);

    if (!sizeCheck.valid) {
      return NextResponse.json(
        {
          type: 'payload_too_large',
          title: 'Request too large',
          status: 413,
          detail: `Request body exceeds maximum size of ${maxSize} bytes.`,
        },
        { status: 413 },
      );
    }

    // 2. Wrap with idempotency if enabled
    const execute = async () => handler(request);

    try {
      if (options?.enableIdempotency) {
        return await withIdempotency(request, execute);
      }
      return await execute();
    } catch (error) {
      // 3. Sanitize errors so no internals leak to the client
      const sanitized = sanitizeError(error);
      return internalError(sanitized.message);
    }
  };
}
