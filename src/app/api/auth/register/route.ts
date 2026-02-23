/**
 * POST /api/auth/register
 * Register a new user and optionally create their first company.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { hashPassword, validatePasswordStrength, signAccessToken, signRefreshToken, REFRESH_TOKEN_COOKIE, getRefreshTokenCookieOptions } from '@/lib/auth';
import { badRequest, conflict, internalError } from '@/lib/api-error';
import { strictLimiter, getClientIP } from '@/lib/rate-limit';

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(12),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  // Optional company creation
  companyName: z.string().min(1).max(200).optional(),
  businessType: z.enum(['SOLE_PROPRIETOR', 'PARTNERSHIP', 'LIMITED_COMPANY', 'NGO', 'OTHER']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: strict 3 req/min per IP for registration
    const ip = getClientIP(request);
    const limit = strictLimiter.check(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { type: 'rate_limit', title: 'Too many registration attempts', status: 429, detail: 'Please try again later.' },
        { status: 429, headers: strictLimiter.headers(limit) }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { email, password, firstName, lastName, phone, companyName, businessType } = parsed.data;

    // Check password strength
    const passwordIssues = validatePasswordStrength(password);
    if (passwordIssues.length > 0) {
      return badRequest('Password too weak', { password: passwordIssues });
    }

    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return conflict('An account with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user (and optionally company) in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
        },
      });

      let company = null;
      let membership = null;

      if (companyName) {
        company = await tx.company.create({
          data: {
            businessName: companyName,
            businessType: businessType ?? 'SOLE_PROPRIETOR',
            currency: 'JMD',
          },
        });

        membership = await tx.companyMember.create({
          data: {
            userId: user.id,
            companyId: company.id,
            role: 'OWNER',
          },
        });

        // Set active company
        await tx.user.update({
          where: { id: user.id },
          data: { activeCompanyId: company.id },
        });
      }

      return { user, company, membership };
    });

    // Generate access token
    const companies = result.company ? [result.company.id] : [];
    const accessToken = await signAccessToken({
      sub: result.user.id,
      email: result.user.email,
      role: result.membership?.role ?? 'STAFF',
      activeCompanyId: result.company?.id ?? null,
      companies,
    });

    // Create a session record
    const session = await prisma.session.create({
      data: {
        userId: result.user.id,
        token: accessToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        userAgent: request.headers.get('user-agent') ?? undefined,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      },
    });

    const refreshToken = await signRefreshToken({
      sub: result.user.id,
      sessionId: session.id,
    });

    // Store refresh token on the session
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken },
    });

    // Build response
    const response = NextResponse.json(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          activeCompanyId: result.company?.id ?? null,
        },
        company: result.company
          ? { id: result.company.id, businessName: result.company.businessName }
          : null,
        accessToken,
      },
      { status: 201 }
    );

    // Set refresh token as httpOnly cookie
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshTokenCookieOptions());
    
    // Set access token cookie for middleware
    response.cookies.set('accessToken', accessToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return response;
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Registration failed');
  }
}
