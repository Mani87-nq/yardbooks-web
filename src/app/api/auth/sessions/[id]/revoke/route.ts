/**
 * POST /api/auth/sessions/[id]/revoke — Revoke a specific session.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import { notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    // Verify the session exists and belongs to the current user
    const session = await prisma.session.findFirst({
      where: { id, userId: user!.sub },
    });

    if (!session) return notFound('Session not found');

    await prisma.session.delete({ where: { id } });

    return NextResponse.json({ message: 'Session revoked successfully' });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to revoke session');
  }
}
