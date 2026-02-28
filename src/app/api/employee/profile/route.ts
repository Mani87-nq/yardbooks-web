/**
 * GET /api/employee/profile
 * Return the authenticated terminal employee's profile info.
 * Uses terminal JWT auth (PIN-based session).
 *
 * This endpoint exists because the terminal cookie is httpOnly
 * and cannot be read client-side. Pages call this endpoint to
 * get the employee's display info (name, role, avatar, etc.).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    return NextResponse.json({
      id: employee!.sub,
      companyId,
      firstName: employee!.firstName,
      lastName: employee!.lastName,
      displayName: employee!.displayName,
      role: employee!.role,
      avatarColor: employee!.avatarColor,
      permissions: employee!.permissions,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get profile');
  }
}
