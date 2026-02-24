/**
 * POST /api/auth/2fa/backup
 * Verify a backup code for 2FA (when authenticator is unavailable).
 * Each backup code can only be used once.
 *
 * Accepts either:
 * - A full access token (for using backup codes from settings)
 * - A short-lived temp token with purpose '2fa_verify' (for login flow)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { jwtVerify } from 'jose';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import {
  signAccessToken,
  signRefreshToken,
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenCookieOptions,
} from '@/lib/auth';
import { badRequest, unauthorized, internalError } from '@/lib/api-error';

const backupSchema = z.object({
  code: z.string().min(6).max(20),
  action: z.enum(['settings', 'login']).default('settings'),
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
    const parsed = backupSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid backup code format');

    const { code, action } = parsed.data;
    let userId: string;
    const isLoginFlow = action === 'login';

    if (isLoginFlow) {
      // Login flow: accept temp 2FA token
      const tempUserId = await extractTempTokenUserId(request);
      if (!tempUserId) {
        return unauthorized('Invalid or expired 2FA verification token');
      }
      userId = tempUserId;
    } else {
      // Settings flow: require full access token with settings:read permission
      const { user, error: authError } = await requirePermission(request, 'settings:read');
      if (authError) return authError;
      userId = user!.sub;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorBackupCodes: true,
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

    if (!dbUser?.twoFactorEnabled) {
      return badRequest('2FA is not enabled');
    }

    // Hash the provided code and check against stored hashes
    const hashedCode = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
    const storedCodes = dbUser.twoFactorBackupCodes ?? [];
    const codeIndex = storedCodes.indexOf(hashedCode);

    if (codeIndex === -1) {
      return unauthorized('Invalid backup code');
    }

    // Remove the used backup code
    const updatedCodes = [...storedCodes];
    updatedCodes.splice(codeIndex, 1);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: updatedCodes },
    });

    // If this is a login flow, issue full tokens
    if (isLoginFlow) {
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

      // ── Single-session enforcement ───────────────────────────────────
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
        message: `Backup code accepted. ${updatedCodes.length} backup codes remaining.`,
        remainingBackupCodes: updatedCodes.length,
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
    }

    // Settings flow: just return success
    return NextResponse.json({
      success: true,
      remainingBackupCodes: updatedCodes.length,
      message: `Backup code accepted. ${updatedCodes.length} backup codes remaining.`,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Backup code verification failed');
  }
}
