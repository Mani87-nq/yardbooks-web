/**
 * PATCH /api/v1/user/active-company
 * Update the authenticated user's active company.
 * - Verifies the user is a member of the target company
 * - Persists the change in the database
 * - Re-issues JWT tokens with the new activeCompanyId
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenCookieOptions,
} from '@/lib/auth';
import { badRequest, unauthorized, internalError } from '@/lib/api-error';

const schema = z.object({
  companyId: z.string().min(1),
});

export async function PATCH(request: NextRequest) {
  try {
    // Extract and verify access token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return unauthorized('Not authenticated');

    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return unauthorized('Invalid or expired token');
    }

    if (!payload?.sub) return unauthorized('Invalid token');

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('companyId is required');

    const { companyId } = parsed.data;

    // Verify user is a member of the target company
    const membership = await prisma.companyMember.findFirst({
      where: { userId: payload.sub, companyId },
      include: { company: true },
    });

    if (!membership) {
      return badRequest('You are not a member of this company');
    }

    // Update active company in database
    await prisma.user.update({
      where: { id: payload.sub },
      data: { activeCompanyId: companyId },
    });

    // Get all company memberships for new token
    const allMemberships = await prisma.companyMember.findMany({
      where: { userId: payload.sub },
      select: { companyId: true },
    });

    // Issue new access token with updated activeCompanyId
    const newAccessToken = await signAccessToken({
      sub: payload.sub,
      email: payload.email as string,
      role: membership.role,
      activeCompanyId: companyId,
      companies: allMemberships.map((m) => m.companyId),
    });

    // Find current session by the old access token and update it
    const session = await prisma.session.findUnique({
      where: { token },
    });

    if (session) {
      const newRefreshToken = await signRefreshToken({
        sub: payload.sub,
        sessionId: session.id,
      });

      await prisma.session.update({
        where: { id: session.id },
        data: { token: newAccessToken, refreshToken: newRefreshToken },
      });

      const response = NextResponse.json({
        message: 'Active company updated',
        companyId,
        accessToken: newAccessToken,
      });

      response.cookies.set(
        REFRESH_TOKEN_COOKIE,
        newRefreshToken,
        getRefreshTokenCookieOptions()
      );
      response.cookies.set('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 15 * 60, // 15 minutes — matches JWT expiry
      });

      return response;
    }

    // Session not found (edge case) — still return the new access token
    return NextResponse.json({
      message: 'Active company updated',
      companyId,
      accessToken: newAccessToken,
    });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to switch company'
    );
  }
}
