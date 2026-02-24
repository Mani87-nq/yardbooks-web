/**
 * POST /api/auth/login
 * Authenticate user and issue JWT tokens.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { SignJWT } from 'jose';
import {
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenCookieOptions,
} from '@/lib/auth';
import { badRequest, unauthorized, internalError } from '@/lib/api-error';
import { authLimiter, getClientIP } from '@/lib/rate-limit';
import { checkAccountLocked, recordFailedLogin, resetFailedLogins } from '@/lib/account-lockout';

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 login attempts per minute per IP
    const ip = getClientIP(request);
    const limit = authLimiter.check(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { type: 'rate_limit', title: 'Too many login attempts', status: 429, detail: 'Please try again later.' },
        { status: 429, headers: authLimiter.headers(limit) }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest('Invalid email or password format');
    }

    const { email, password } = parsed.data;

    // Find user with company memberships (twoFactorEnabled is included by default as a scalar field)
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        companyMemberships: {
          include: { company: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      return unauthorized('Invalid email or password');
    }

    // Check if account is locked
    const lockStatus = await checkAccountLocked(user.id);
    if (lockStatus.locked) {
      return NextResponse.json(
        {
          type: 'account_locked',
          title: 'Account locked',
          status: 423,
          detail: `Account is locked due to too many failed login attempts. Try again after ${lockStatus.lockedUntil?.toISOString()}.`,
        },
        { status: 423 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      const lockResult = await recordFailedLogin(user.id);
      if (lockResult.locked) {
        return NextResponse.json(
          {
            type: 'account_locked',
            title: 'Account locked',
            status: 423,
            detail: `Account has been locked due to too many failed login attempts. Try again after ${lockResult.lockedUntil?.toISOString()}.`,
          },
          { status: 423 }
        );
      }
      return unauthorized('Invalid email or password');
    }

    // If user has 2FA enabled, issue a short-lived temp token instead of full tokens
    if (user.twoFactorEnabled) {
      // Reset failed login attempts (password was correct)
      await resetFailedLogins(user.id);

      const accessSecret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
      const tempToken = await new SignJWT({ sub: user.id, purpose: '2fa_verify' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .setIssuer('yaadbooks')
        .sign(accessSecret);

      return NextResponse.json({
        requiresTwoFactor: true,
        tempToken,
        userId: user.id,
      });
    }

    // Determine active company and role
    const companies = user.companyMemberships.map((m) => m.companyId);
    const activeCompanyId = user.activeCompanyId ?? companies[0] ?? null;
    const activeMembership = user.companyMemberships.find((m) => m.companyId === activeCompanyId);
    const role = activeMembership?.role ?? 'STAFF';

    // Generate tokens
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role,
      activeCompanyId,
      companies,
    });

    // ── Single-session enforcement ─────────────────────────────────────
    // Delete ALL existing sessions for this user so that any other
    // browser / device is forced to re-authenticate. This prevents
    // account sharing (one subscription used on many machines).
    await prisma.session.deleteMany({ where: { userId: user.id } });

    // Create a session record
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        userAgent: request.headers.get('user-agent') ?? undefined,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      },
    });

    const refreshToken = await signRefreshToken({
      sub: user.id,
      sessionId: session.id,
    });

    // Store refresh token on the session
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken },
    });

    // Reset failed login attempts on successful login
    await resetFailedLogins(user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Build response
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        activeCompanyId,
      },
      companies: user.companyMemberships.map((m) => ({
        id: m.company.id,
        businessName: m.company.businessName,
        role: m.role,
      })),
      accessToken,
    });

    // Set refresh token as httpOnly cookie
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshTokenCookieOptions());
    
    // Set access token cookie for middleware + API route auth.
    // httpOnly: true prevents XSS from stealing the token via document.cookie.
    // The browser sends this cookie automatically with same-origin requests.
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes — matches JWT expiry
    });

    return response;
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Login failed');
  }
}
