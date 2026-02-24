/**
 * Auth middleware utilities for API route handlers.
 * Extracts and verifies the JWT from the Authorization header,
 * checks RBAC permissions, and scopes queries to the active company.
 */
import { NextRequest } from 'next/server';
import { verifyAccessToken, type AccessTokenPayload } from './jwt';
import { hasPermission, type Permission, type Role } from './rbac';
import { unauthorized, forbidden } from '@/lib/api-error';

/**
 * Extract and verify the access token from the request.
 * Checks the Authorization header first, then falls back to the
 * accessToken cookie. This ensures API routes authenticate correctly
 * even when the client-side in-memory token is unavailable (e.g.
 * immediately after a Google OAuth server-redirect).
 */
export async function getAuthUser(request: NextRequest): Promise<AccessTokenPayload | null> {
  // 1. Prefer Authorization header (set by api-client in-memory token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      return await verifyAccessToken(token);
    } catch {
      return null;
    }
  }

  // 2. Fall back to accessToken cookie (set by server on login/OAuth redirect)
  const cookieToken = request.cookies.get('accessToken')?.value;
  if (cookieToken) {
    try {
      return await verifyAccessToken(cookieToken);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Require authentication. Returns the user payload or throws an API error response.
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return { user: null, error: unauthorized() };
  }
  return { user, error: null };
}

/**
 * Require authentication + specific permission.
 */
export async function requirePermission(request: NextRequest, permission: Permission) {
  const { user, error } = await requireAuth(request);
  if (error) return { user: null, error };

  if (!hasPermission(user!.role as Role, permission)) {
    return { user: null, error: forbidden(`Missing permission: ${permission}`) };
  }

  return { user: user!, error: null };
}

/**
 * Get the active company ID from the authenticated user.
 * All data queries should be scoped to this company.
 */
export function getCompanyId(user: AccessTokenPayload): string | null {
  return user.activeCompanyId;
}

/**
 * Require that the user has an active company selected.
 */
export function requireCompany(user: AccessTokenPayload) {
  const companyId = getCompanyId(user);
  if (!companyId) {
    return { companyId: null, error: forbidden('No active company selected') };
  }
  // Verify user actually belongs to this company
  if (!user.companies.includes(companyId)) {
    return { companyId: null, error: forbidden('Not a member of this company') };
  }
  return { companyId, error: null };
}
