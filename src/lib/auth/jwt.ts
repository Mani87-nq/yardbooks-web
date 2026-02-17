/**
 * JWT utilities using jose library (RS256-compatible, Edge-runtime safe).
 * Access tokens: short-lived (15 min)
 * Refresh tokens: longer-lived (7 days), stored in httpOnly cookie
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// ============================================
// TOKEN CONFIGURATION
// ============================================

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  return new TextEncoder().encode(secret);
}

function getRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
  return new TextEncoder().encode(secret);
}

// ============================================
// TOKEN PAYLOAD TYPES
// ============================================

export interface AccessTokenPayload extends JWTPayload {
  sub: string;         // User ID
  email: string;
  role: string;
  activeCompanyId: string | null;
  companies: string[]; // Company IDs the user belongs to
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;         // User ID
  sessionId: string;   // Session ID for token rotation / revocation
}

// ============================================
// SIGN TOKENS
// ============================================

export async function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer('yardbooks')
    .sign(getAccessSecret());
}

export async function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setIssuer('yardbooks')
    .sign(getRefreshSecret());
}

// ============================================
// VERIFY TOKENS
// ============================================

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getAccessSecret(), {
    issuer: 'yardbooks',
  });
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getRefreshSecret(), {
    issuer: 'yardbooks',
  });
  return payload as unknown as RefreshTokenPayload;
}

// ============================================
// COOKIE HELPERS
// ============================================

export const REFRESH_TOKEN_COOKIE = 'yardbooks_refresh_token';

export function getRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}
