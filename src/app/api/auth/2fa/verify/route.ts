/**
 * POST /api/auth/2fa/verify
 * Verify a TOTP code to complete 2FA setup or during login.
 *
 * Accepts either:
 * - A full access token (for 2FA setup from settings)
 * - A short-lived temp token with purpose '2fa_verify' (for login flow)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { jwtVerify } from 'jose';
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

/**
 * Extract userId from a temp 2FA token (purpose: '2fa_verify').
 * Returns the userId if valid, or null if the token is not a 2FA temp token.
 */
async function extractTempTokenUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
    const { payload } = await jwtVerify(token, secret, { issuer: 'yaadbooks' });
    if (payload.purpose === '2fa_verify' && typeof payload.sub === 'string') {
      return payload.sub;
    }
  } catch {
    // Token invalid or expired — fall through
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid code format');

    const { code, action } = parsed.data;
    let userId: string;

    if (action === 'login') {
      // Login flow: accept temp 2FA token
      const tempUserId = await extractTempTokenUserId(request);
      if (!tempUserId) {
        return unauthorized('Invalid or expired 2FA verification token');
      }
      userId = tempUserId;
    } else {
      // Setup flow: require full access token with settings:update permission
      const { user, error: authError } = await requirePermission(request, 'settings:update');
      if (authError) return authError;
      userId = user!.sub;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorSecret: true,
        twoFactorEnabled: true,
        email: true,
        firstName: true,
        lastName: true,
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

    // ── Single-session enforcement ─────────────────────────────────────
    // Delete ALL existing sessions so only one device can be active.
    await prisma.session.deleteMany({ where: { userId } });

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
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
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
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes — matches JWT expiry
    });

    return response;
  } catch (error) {
    return internalError(error instanceof Error ? error.message : '2FA verification failed');
  }
}
