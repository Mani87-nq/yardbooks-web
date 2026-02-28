/**
 * Auth middleware utilities for Employee Portal / Kiosk API routes.
 * Extracts and verifies the terminal JWT from the cookie or Authorization header.
 *
 * Pattern mirrors src/lib/auth/middleware.ts but for terminal (PIN-authenticated) sessions.
 */
import { NextRequest } from 'next/server';
import {
  verifyTerminalToken,
  TERMINAL_TOKEN_COOKIE,
  type TerminalTokenPayload,
} from './terminal-jwt';
import { unauthorized } from '@/lib/api-error';

/**
 * Extract and verify the terminal token from the request.
 * Checks the Authorization header first (for API clients), then falls
 * back to the terminal cookie (for browser-based kiosk sessions).
 */
export async function getTerminalUser(
  request: NextRequest
): Promise<TerminalTokenPayload | null> {
  // 1. Prefer Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      return await verifyTerminalToken(token);
    } catch {
      return null;
    }
  }

  // 2. Fall back to terminal cookie
  const cookieToken = request.cookies.get(TERMINAL_TOKEN_COOKIE)?.value;
  if (cookieToken) {
    try {
      return await verifyTerminalToken(cookieToken);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Require terminal authentication.
 * Returns the employee payload or an API error response.
 */
export async function requireTerminalAuth(request: NextRequest) {
  const employee = await getTerminalUser(request);
  if (!employee) {
    return { employee: null, companyId: null, error: unauthorized('Terminal authentication required. Please sign in with your PIN.') };
  }
  return { employee, companyId: employee.companyId, error: null };
}
