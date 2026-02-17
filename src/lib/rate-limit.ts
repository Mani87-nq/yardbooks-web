/**
 * In-memory rate limiter using a sliding window.
 * Designed to be replaced with Upstash Redis in production.
 *
 * Usage in API routes:
 *   const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });
 *   const result = limiter.check(ip);
 *   if (!result.allowed) return tooManyRequests();
 */

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp in ms
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter(config: RateLimitConfig) {
  const { maxRequests, windowMs } = config;
  const windows = new Map<string, WindowEntry>();

  // Periodically clean up expired entries (every 60s)
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (entry.resetAt < now) {
        windows.delete(key);
      }
    }
  }, 60_000);

  // Allow cleanup timer to not prevent process exit
  if (cleanup.unref) cleanup.unref();

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const entry = windows.get(key);

      if (!entry || entry.resetAt < now) {
        // New window
        const resetAt = now + windowMs;
        windows.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: maxRequests - 1, resetAt };
      }

      // Existing window
      entry.count++;
      if (entry.count > maxRequests) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
      }

      return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
    },

    /** Get rate limit headers for the response */
    headers(result: RateLimitResult): Record<string, string> {
      return {
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      };
    },
  };
}

// ============================================
// PRE-CONFIGURED LIMITERS
// ============================================

/** Auth endpoints: 5 requests per minute per IP */
export const authLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

/** General API: 60 requests per minute per IP */
export const apiLimiter = createRateLimiter({ maxRequests: 60, windowMs: 60_000 });

/** Strict: 3 requests per minute (password reset, etc.) */
export const strictLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });

// ============================================
// HELPER: Extract client IP from request
// ============================================

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  return '127.0.0.1';
}
