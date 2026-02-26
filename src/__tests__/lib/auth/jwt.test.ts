/**
 * JWT Token Management Tests
 *
 * Tests for access token and refresh token signing/verification,
 * expiry, issuer validation, and secret handling.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Set env vars BEFORE importing the module
const TEST_ACCESS_SECRET = 'test-access-secret-that-is-long-enough-for-hs256';
const TEST_REFRESH_SECRET = 'test-refresh-secret-that-is-long-enough-for-hs256';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = TEST_ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;
});

afterAll(() => {
  delete process.env.JWT_ACCESS_SECRET;
  delete process.env.JWT_REFRESH_SECRET;
});

// Dynamic import so env vars are set first
const jwtModule = () => import('@/lib/auth/jwt');

describe('JWT Token Management', () => {
  // ──────────────────────────────────────────
  // Access Tokens
  // ──────────────────────────────────────────

  describe('signAccessToken', () => {
    it('should produce a valid JWT string', async () => {
      const { signAccessToken } = await jwtModule();
      const token = await signAccessToken({
        sub: 'user-123',
        email: 'test@yaadbooks.com',
        role: 'OWNER',
        activeCompanyId: 'company-1',
        companies: ['company-1', 'company-2'],
      });

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      // JWT format: header.payload.signature
      expect(token.split('.')).toHaveLength(3);
    });

    it('should embed the correct payload fields', async () => {
      const { signAccessToken, verifyAccessToken } = await jwtModule();
      const payload = {
        sub: 'user-456',
        email: 'owner@business.com',
        role: 'ADMIN',
        activeCompanyId: 'comp-abc',
        companies: ['comp-abc', 'comp-def'],
      };

      const token = await signAccessToken(payload);
      const decoded = await verifyAccessToken(token);

      expect(decoded.sub).toBe('user-456');
      expect(decoded.email).toBe('owner@business.com');
      expect(decoded.role).toBe('ADMIN');
      expect(decoded.activeCompanyId).toBe('comp-abc');
      expect(decoded.companies).toEqual(['comp-abc', 'comp-def']);
    });

    it('should include issuer "yaadbooks"', async () => {
      const { signAccessToken, verifyAccessToken } = await jwtModule();
      const token = await signAccessToken({
        sub: 'user-1',
        email: 'a@b.com',
        role: 'STAFF',
        activeCompanyId: null,
        companies: [],
      });

      const decoded = await verifyAccessToken(token);
      expect(decoded.iss).toBe('yaadbooks');
    });

    it('should include iat and exp claims', async () => {
      const { signAccessToken, verifyAccessToken } = await jwtModule();
      const token = await signAccessToken({
        sub: 'user-1',
        email: 'a@b.com',
        role: 'STAFF',
        activeCompanyId: null,
        companies: [],
      });

      const decoded = await verifyAccessToken(token);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      // exp should be ~15 minutes after iat
      const diffSeconds = decoded.exp! - decoded.iat!;
      expect(diffSeconds).toBe(15 * 60);
    });
  });

  describe('verifyAccessToken', () => {
    it('should reject a tampered token', async () => {
      const { signAccessToken, verifyAccessToken } = await jwtModule();
      const token = await signAccessToken({
        sub: 'user-1',
        email: 'a@b.com',
        role: 'STAFF',
        activeCompanyId: null,
        companies: [],
      });

      // Tamper with the payload
      const parts = token.split('.');
      parts[1] = parts[1] + 'TAMPERED';
      const tamperedToken = parts.join('.');

      await expect(verifyAccessToken(tamperedToken)).rejects.toThrow();
    });

    it('should reject a completely invalid string', async () => {
      const { verifyAccessToken } = await jwtModule();
      await expect(verifyAccessToken('not-a-jwt')).rejects.toThrow();
    });

    it('should reject an empty string', async () => {
      const { verifyAccessToken } = await jwtModule();
      await expect(verifyAccessToken('')).rejects.toThrow();
    });
  });

  // ──────────────────────────────────────────
  // Refresh Tokens
  // ──────────────────────────────────────────

  describe('signRefreshToken', () => {
    it('should produce a valid JWT with sub and sessionId', async () => {
      const { signRefreshToken, verifyRefreshToken } = await jwtModule();
      const token = await signRefreshToken({
        sub: 'user-789',
        sessionId: 'session-abc',
      });

      expect(token).toBeTruthy();
      const decoded = await verifyRefreshToken(token);
      expect(decoded.sub).toBe('user-789');
      expect(decoded.sessionId).toBe('session-abc');
      expect(decoded.iss).toBe('yaadbooks');
    });

    it('should have 7-day expiry', async () => {
      const { signRefreshToken, verifyRefreshToken } = await jwtModule();
      const token = await signRefreshToken({
        sub: 'user-1',
        sessionId: 'sess-1',
      });

      const decoded = await verifyRefreshToken(token);
      const diffSeconds = decoded.exp! - decoded.iat!;
      expect(diffSeconds).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should not verify an access token as a refresh token', async () => {
      const { signAccessToken, verifyRefreshToken } = await jwtModule();
      const accessToken = await signAccessToken({
        sub: 'user-1',
        email: 'a@b.com',
        role: 'STAFF',
        activeCompanyId: null,
        companies: [],
      });

      // Access token is signed with a different secret, so verification should fail
      await expect(verifyRefreshToken(accessToken)).rejects.toThrow();
    });

    it('should not verify a refresh token as an access token', async () => {
      const { signRefreshToken, verifyAccessToken } = await jwtModule();
      const refreshToken = await signRefreshToken({
        sub: 'user-1',
        sessionId: 'sess-1',
      });

      await expect(verifyAccessToken(refreshToken)).rejects.toThrow();
    });
  });

  // ──────────────────────────────────────────
  // Cookie Helpers
  // ──────────────────────────────────────────

  describe('getRefreshTokenCookieOptions', () => {
    it('should return httpOnly and lax sameSite', async () => {
      const { getRefreshTokenCookieOptions } = await jwtModule();
      const opts = getRefreshTokenCookieOptions();

      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
      expect(opts.path).toBe('/');
      expect(opts.maxAge).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('REFRESH_TOKEN_COOKIE', () => {
    it('should be a consistent cookie name', async () => {
      const { REFRESH_TOKEN_COOKIE } = await jwtModule();
      expect(REFRESH_TOKEN_COOKIE).toBe('yaadbooks_refresh_token');
    });
  });

  // ──────────────────────────────────────────
  // Missing Secret Handling
  // ──────────────────────────────────────────

  describe('Missing secrets', () => {
    it('should throw when JWT_ACCESS_SECRET is missing', async () => {
      const originalSecret = process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_ACCESS_SECRET;

      // Re-import to pick up the missing env var at call time
      const { signAccessToken } = await jwtModule();

      await expect(
        signAccessToken({
          sub: 'user-1',
          email: 'a@b.com',
          role: 'STAFF',
          activeCompanyId: null,
          companies: [],
        }),
      ).rejects.toThrow('JWT_ACCESS_SECRET is not set');

      // Restore
      process.env.JWT_ACCESS_SECRET = originalSecret;
    });

    it('should throw when JWT_REFRESH_SECRET is missing', async () => {
      const originalSecret = process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      const { signRefreshToken } = await jwtModule();

      await expect(
        signRefreshToken({ sub: 'user-1', sessionId: 'sess-1' }),
      ).rejects.toThrow('JWT_REFRESH_SECRET is not set');

      process.env.JWT_REFRESH_SECRET = originalSecret;
    });
  });
});
