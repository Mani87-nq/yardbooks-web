/**
 * POST /api/auth/2fa/verify
 * Verify a TOTP code to complete 2FA setup or during login.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { TOTP, Secret } from 'otpauth';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import {
  signAccessToken,
  signRefreshToken,
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenCookieOptions,
} from '@/lib/auth';
import { badRequest, unauthorized, internalError } from '@/lib/api-error';

const verifySchema = z.object({
  code: z.string().length(6),
  action: z.enum(['setup', 'login']).default('setup'),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid code format');

    const { code, action } = parsed.data;
    const userId = user!.sub;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorSecret: true,
        twoFactorEnabled: true,
        email: true,
        activeCompanyId: true,
        companyMemberships: {
          include: { company: true },
        },
      },
    });

    if (!dbUser?.twoFactorSecret) {
      return badRequest('2FA has not been set up. Call /api/auth/2fa/setup first.');
    }

    // Verify TOTP code
    const totp = new TOTP({
      issuer: 'YaadBooks',
      label: dbUser.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(dbUser.twoFactorSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
      return unauthorized('Invalid 2FA code');
    }

    if (action === 'setup') {
      // Complete 2FA setup
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });

      return NextResponse.json({
        success: true,
        message: '2FA has been enabled successfully.',
      });
    }

    // Login verification — issue fresh tokens
    const companies = dbUser.companyMemberships.map(m => m.companyId);
    const activeCompanyId = dbUser.activeCompanyId ?? companies[0] ?? null;
    const activeMembership = dbUser.companyMemberships.find(m => m.companyId === activeCompanyId);
    const role = activeMembership?.role ?? 'STAFF';

    const accessToken = await signAccessToken({
      sub: userId,
      email: dbUser.email,
      role,
      activeCompanyId,
      companies,
    });

    const session = await prisma.session.create({
      data: {
        userId,
        token: accessToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: request.headers.get('user-agent') ?? undefined,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      },
    });

    const refreshToken = await signRefreshToken({
      sub: userId,
      sessionId: session.id,
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    const response = NextResponse.json({
      success: true,
      message: '2FA verification successful.',
      user: {
        id: userId,
        email: dbUser.email,
        activeCompanyId,
      },
      companies: dbUser.companyMemberships.map(m => ({
        id: m.company.id,
        businessName: m.company.businessName,
        role: m.role,
      })),
      accessToken,
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshTokenCookieOptions());
    response.cookies.set('accessToken', accessToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    return internalError(error instanceof Error ? error.message : '2FA verification failed');
  }
}
