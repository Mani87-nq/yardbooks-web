/**
 * GET /api/auth/sessions — List all active sessions for the authenticated user.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    // Extract the current bearer token to identify the active session
    const authHeader = request.headers.get('Authorization');
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const sessions = await prisma.session.findMany({
      where: {
        userId: user!.sub,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
        token: true, // needed to compare for isCurrent, stripped before response
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = sessions.map(({ token, ...session }) => ({
      ...session,
      isCurrent: token === currentToken,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list sessions');
  }
}
