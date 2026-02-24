/**
 * POST /api/auth/refresh
 * Rotate refresh token and issue a new access token.
 * Uses Session records to detect stolen refresh tokens.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenCookieOptions,
} from '@/lib/auth';
import { unauthorized, internalError } from '@/lib/api-error';
import { authLimiter, getClientIP } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 req/min per IP for token refresh
    const ip = getClientIP(request);
    const limit = authLimiter.check(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { type: 'rate_limit', title: 'Too many refresh attempts', status: 429, detail: 'Please try again later.' },
        { status: 429, headers: authLimiter.headers(limit) }
      );
    }

    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) {
      return unauthorized('No refresh token provided');
    }

    // Verify the refresh token
    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      return unauthorized('Invalid or expired refresh token');
    }

    // Find the session
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          include: {
            companyMemberships: true,
          },
        },
      },
    });

    if (!session || !session.user) {
      return unauthorized('Session not found');
    }

    // Check if refresh token matches the one stored on the session
    if (session.refreshToken !== refreshToken) {
      // Possible token theft — delete this session
      await prisma.session.delete({ where: { id: session.id } });
      return unauthorized('Token has been revoked. Please log in again.');
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      return unauthorized('Session expired. Please log in again.');
    }

    const user = session.user;

    // Determine active company and role
    const companies = user.companyMemberships.map((m) => m.companyId);
    const activeCompanyId = user.activeCompanyId ?? companies[0] ?? null;
    const activeMembership = user.companyMemberships.find((m) => m.companyId === activeCompanyId);
    const role = activeMembership?.role ?? 'STAFF';

    // Issue new tokens (rotation)
    const newAccessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role,
      activeCompanyId,
      companies,
    });

    const newRefreshToken = await signRefreshToken({
      sub: user.id,
      sessionId: session.id,
    });

    // Update session with new tokens
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // extend 7 days
      },
    });

    // Build response
    const response = NextResponse.json({
      accessToken: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        activeCompanyId,
      },
    });

    // Set new refresh token cookie
    response.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, getRefreshTokenCookieOptions());
    
    // Set access token cookie (httpOnly to prevent XSS token theft)
    response.cookies.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes — matches JWT expiry
    });

    return response;
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Token refresh failed');
  }
}
