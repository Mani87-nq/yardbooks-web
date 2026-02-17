/**
 * POST /api/auth/sessions/revoke-all — Revoke all sessions except the current one.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    // Extract the current bearer token to identify the active session
    const authHeader = request.headers.get('Authorization');
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!currentToken) return badRequest('Unable to identify current session');

    // Find the current session by token
    const currentSession = await prisma.session.findUnique({
      where: { token: currentToken },
    });

    if (!currentSession) return badRequest('Current session not found');

    // Delete all sessions for this user except the current one
    const result = await prisma.session.deleteMany({
      where: {
        userId: user!.sub,
        id: { not: currentSession.id },
      },
    });

    return NextResponse.json({
      message: 'All other sessions revoked successfully',
      revokedCount: result.count,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to revoke sessions');
  }
}
