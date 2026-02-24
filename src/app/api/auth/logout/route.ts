/**
 * POST /api/auth/logout
 * Clear the refresh token cookie and delete the session.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { REFRESH_TOKEN_COOKIE, verifyRefreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Try to read the refresh token to find the session
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

    if (refreshToken) {
      try {
        const payload = await verifyRefreshToken(refreshToken);
        // Delete the session to invalidate the refresh token
        await prisma.session.delete({
          where: { id: payload.sessionId },
        }).catch(() => {
          // Session may already be deleted — that's fine
        });
      } catch {
        // Token already invalid — that's fine, just clear the cookie
      }
    }

    // Clear the refresh token and access token cookies
    const response = NextResponse.json({ message: 'Logged out successfully' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 0,
    });
    
    // Clear access token cookie (must match httpOnly setting used when setting it)
    response.cookies.set('accessToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch {
    // Even if something fails, clear the cookies
    const response = NextResponse.json({ message: 'Logged out' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
      httpOnly: true,
      path: '/api/auth',
      maxAge: 0,
    });
    response.cookies.set('accessToken', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });
    return response;
  }
}
