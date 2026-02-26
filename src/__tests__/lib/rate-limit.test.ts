/**
 * Rate Limiter Tests
 *
 * Tests the sliding window rate limiter, pre-configured limiters,
 * and client IP extraction.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter, getClientIP } from '@/lib/rate-limit';

describe('Rate Limiter', () => {
  // ──────────────────────────────────────────
  // createRateLimiter
  // ──────────────────────────────────────────

  describe('createRateLimiter', () => {
    it('should allow requests within the limit', () => {
      const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

      const r1 = limiter.check('192.168.1.1');
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(4);

      const r2 = limiter.check('192.168.1.1');
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(3);
    });

    it('should block requests exceeding the limit', () => {
      const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });

      limiter.check('ip-1'); // 1
      limiter.check('ip-1'); // 2
      limiter.check('ip-1'); // 3 — at limit

      const blocked = limiter.check('ip-1'); // 4 — over limit
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('should track different keys independently', () => {
      const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });

      limiter.check('user-a'); // user-a: 1
      limiter.check('user-a'); // user-a: 2
      const blockedA = limiter.check('user-a'); // user-a: blocked
      expect(blockedA.allowed).toBe(false);

      // user-b should still be fine
      const resultB = limiter.check('user-b');
      expect(resultB.allowed).toBe(true);
      expect(resultB.remaining).toBe(1);
    });

    it('should reset after the window expires', () => {
      vi.useFakeTimers();

      const limiter = createRateLimiter({ maxRequests: 2, windowMs: 10_000 });

      limiter.check('ip-1'); // 1
      limiter.check('ip-1'); // 2
      const blocked = limiter.check('ip-1'); // blocked
      expect(blocked.allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(11_000);

      const afterReset = limiter.check('ip-1');
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(1);

      vi.useRealTimers();
    });

    it('should include resetAt timestamp in the future', () => {
      const now = Date.now();
      const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });

      const result = limiter.check('ip-1');
      expect(result.resetAt).toBeGreaterThan(now);
      expect(result.resetAt).toBeLessThanOrEqual(now + 60_000 + 100); // small tolerance
    });

    it('should return remaining=0 when blocked', () => {
      const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });

      limiter.check('ip-1'); // 1 — allowed
      const blocked = limiter.check('ip-1'); // 2 — blocked
      expect(blocked.remaining).toBe(0);
    });

    it('should correctly count down remaining', () => {
      const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

      expect(limiter.check('ip').remaining).toBe(4);
      expect(limiter.check('ip').remaining).toBe(3);
      expect(limiter.check('ip').remaining).toBe(2);
      expect(limiter.check('ip').remaining).toBe(1);
      expect(limiter.check('ip').remaining).toBe(0);
    });
  });

  // ──────────────────────────────────────────
  // Rate Limit Headers
  // ──────────────────────────────────────────

  describe('headers', () => {
    it('should generate correct rate limit headers', () => {
      const limiter = createRateLimiter({ maxRequests: 100, windowMs: 60_000 });
      const result = limiter.check('ip-1');
      const headers = limiter.headers(result);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('99');
      expect(headers['X-RateLimit-Reset']).toBeTruthy();
      // Reset should be a Unix timestamp in seconds
      expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should never return negative remaining', () => {
      const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
      limiter.check('ip');
      const blocked = limiter.check('ip');
      const headers = limiter.headers(blocked);

      expect(Number(headers['X-RateLimit-Remaining'])).toBe(0);
    });
  });

  // ──────────────────────────────────────────
  // Client IP Extraction
  // ──────────────────────────────────────────

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for (first entry)', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 172.16.0.1' },
      });
      expect(getClientIP(request)).toBe('1.2.3.4');
    });

    it('should extract IP from x-real-ip when x-forwarded-for is missing', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-real-ip': '5.6.7.8' },
      });
      expect(getClientIP(request)).toBe('5.6.7.8');
    });

    it('should fallback to 127.0.0.1 when no IP headers present', () => {
      const request = new Request('https://example.com');
      expect(getClientIP(request)).toBe('127.0.0.1');
    });

    it('should trim whitespace from x-forwarded-for', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '  9.10.11.12  , 10.0.0.1' },
      });
      expect(getClientIP(request)).toBe('9.10.11.12');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '1.1.1.1',
          'x-real-ip': '2.2.2.2',
        },
      });
      expect(getClientIP(request)).toBe('1.1.1.1');
    });
  });
});
