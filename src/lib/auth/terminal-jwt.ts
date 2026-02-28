/**
 * Terminal JWT utilities for Employee Portal / Kiosk mode.
 * Separate from the main user JWT system — terminal tokens are issued
 * when an employee authenticates with their PIN on a kiosk device.
 *
 * Terminal tokens: 8 hours (one shift), stored in httpOnly cookie.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// ============================================
// TOKEN CONFIGURATION
// ============================================

const TERMINAL_TOKEN_EXPIRY = '8h';

function getTerminalSecret(): Uint8Array {
  // Use dedicated secret if available, otherwise derive from access secret
  const secret = process.env.JWT_TERMINAL_SECRET
    || (process.env.JWT_ACCESS_SECRET ? `${process.env.JWT_ACCESS_SECRET}_terminal` : null);
  if (!secret) throw new Error('JWT_TERMINAL_SECRET or JWT_ACCESS_SECRET is not set');
  return new TextEncoder().encode(secret);
}

// ============================================
// TOKEN PAYLOAD TYPE
// ============================================

export interface TerminalTokenPayload extends JWTPayload {
  sub: string;           // EmployeeProfile ID
  companyId: string;     // Company ID
  role: string;          // EmployeeRole (POS_CASHIER, POS_SERVER, SHIFT_MANAGER, STORE_MANAGER)
  permissions: Record<string, unknown>; // Granular permissions JSON
  firstName: string;     // For display in UI without extra DB call
  lastName: string;
  displayName: string | null;
  avatarColor: string;
  type: 'terminal';      // Discriminator to distinguish from user tokens
}

// ============================================
// SIGN TOKEN
// ============================================

export async function signTerminalToken(
  payload: Omit<TerminalTokenPayload, 'iat' | 'exp' | 'type'>
): Promise<string> {
  return new SignJWT({ ...payload, type: 'terminal' } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TERMINAL_TOKEN_EXPIRY)
    .setIssuer('yaadbooks')
    .setAudience('terminal')
    .sign(getTerminalSecret());
}

// ============================================
// VERIFY TOKEN
// ============================================

export async function verifyTerminalToken(token: string): Promise<TerminalTokenPayload> {
  const { payload } = await jwtVerify(token, getTerminalSecret(), {
    issuer: 'yaadbooks',
    audience: 'terminal',
  });

  // Verify it's actually a terminal token
  if ((payload as Record<string, unknown>).type !== 'terminal') {
    throw new Error('Not a terminal token');
  }

  return payload as unknown as TerminalTokenPayload;
}

// ============================================
// COOKIE HELPERS
// ============================================

export const TERMINAL_TOKEN_COOKIE = 'yaadbooks_terminal_token';

export function getTerminalTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  };
}
