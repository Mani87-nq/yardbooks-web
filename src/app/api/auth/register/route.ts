/**
 * POST /api/auth/register
 * Register a new user and optionally create their first company.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { hashPassword, validatePasswordStrength, signAccessToken, signRefreshToken, REFRESH_TOKEN_COOKIE, getRefreshTokenCookieOptions } from '@/lib/auth';
import { badRequest, conflict, internalError } from '@/lib/api-error';
import { strictLimiter, getClientIP } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/service';
import { emailVerificationEmail, welcomeEmail } from '@/lib/email/templates';

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(12),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  // Optional company creation
  companyName: z.string().min(1).max(200).optional(),
  businessType: z.enum(['SOLE_PROPRIETOR', 'PARTNERSHIP', 'LIMITED_COMPANY', 'NGO', 'OTHER']).optional(),
  // Optional referral code
  referralCode: z.string().max(20).optional(),
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

    const { email, password, firstName, lastName, phone, companyName, businessType, referralCode } = parsed.data;

    // Check password strength
    const passwordIssues = validatePasswordStrength(password);
    if (passwordIssues.length > 0) {
      return badRequest('Password too weak', { password: passwordIssues });
    }

    // Check for existing user
    // NOTE: After trial disposal, anonymizeUser() changes the email to
    // "deleted-{id}@anonymized.yaadbooks.local", so this check naturally
    // returns null for disposed accounts — re-registration just works.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return conflict('An account with this email already exists');
    }

    // Prevent trial abuse: only one active trialing company per email
    if (companyName) {
      const existingTrialing = await prisma.company.findFirst({
        where: {
          subscriptionStatus: 'TRIALING',
          members: { some: { user: { email } } },
        },
      });
      if (existingTrialing) {
        return conflict('A free trial is already active for this email address.');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Validate referral code before transaction (if provided)
    let validReferral: {
      id: string;
      code: string;
      discountValue: number;
      discountType: string;
      trialExtendDays: number;
    } | null = null;

    if (referralCode) {
      const normalizedCode = referralCode.toUpperCase().trim();
      if (normalizedCode) {
        const refCode = await prisma.referralCode.findUnique({
          where: { code: normalizedCode },
        });

        if (refCode && refCode.isActive) {
          const notExpired = !refCode.expiresAt || refCode.expiresAt > new Date();
          const notMaxedOut = refCode.maxUses === null || refCode.currentUses < refCode.maxUses;

          if (notExpired && notMaxedOut) {
            validReferral = {
              id: refCode.id,
              code: refCode.code,
              discountValue: Number(refCode.discountValue),
              discountType: refCode.discountType,
              trialExtendDays: refCode.trialExtendDays,
            };
          }
        }
        // If referral code is invalid we silently ignore it during registration
        // (the frontend already validated it — this is a graceful fallback)
      }
    }

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
        // 14-day free trial: new companies start on BUSINESS plan with TRIALING status
        const now = new Date();
        const baseTrial = 14; // days
        const bonusDays = validReferral?.trialExtendDays ?? 0;
        const totalTrialDays = baseTrial + bonusDays;
        const trialEnd = new Date(now.getTime() + totalTrialDays * 24 * 60 * 60 * 1000);

        company = await tx.company.create({
          data: {
            businessName: companyName,
            businessType: businessType ?? 'SOLE_PROPRIETOR',
            currency: 'JMD',
            subscriptionPlan: 'BUSINESS',
            subscriptionStatus: 'TRIALING',
            subscriptionStartDate: now,
            subscriptionEndDate: trialEnd,
            referredByCode: validReferral?.code ?? null,
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

        // Record referral redemption if a valid code was used
        if (validReferral) {
          await tx.referralCode.update({
            where: { id: validReferral.id },
            data: { currentUses: { increment: 1 } },
          });

          await tx.referralRedemption.create({
            data: {
              referralCodeId: validReferral.id,
              redeemedByUserId: user.id,
              redeemedByCompanyId: company.id,
              discountApplied: validReferral.discountValue,
              trialDaysAdded: validReferral.trialExtendDays,
            },
          });
        }
      }

      // ── Auto-accept pending invites for this email ──
      const pendingInvites = await tx.pendingInvite.findMany({
        where: {
          email: email.toLowerCase(),
          acceptedAt: null,
          expiresAt: { gt: new Date() }, // Only accept non-expired invites
        },
      });

      const acceptedCompanyIds: string[] = [];

      for (const invite of pendingInvites) {
        // Check if already a member (e.g., from company creation above)
        const existingMember = await tx.companyMember.findUnique({
          where: { companyId_userId: { companyId: invite.companyId, userId: user.id } },
        });

        if (!existingMember) {
          await tx.companyMember.create({
            data: {
              userId: user.id,
              companyId: invite.companyId,
              role: invite.role,
            },
          });
          acceptedCompanyIds.push(invite.companyId);
        }

        // Mark invite as accepted
        await tx.pendingInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });
      }

      // If no company was created but invites were accepted, set first invited company as active
      if (!company && acceptedCompanyIds.length > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: { activeCompanyId: acceptedCompanyIds[0] },
        });
      }

      return { user, company, membership, acceptedInvites: acceptedCompanyIds };
    });

    // Send verification email
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');

    await prisma.verificationToken.create({
      data: {
        email,
        token: verifyTokenHash,
        type: 'email_verify',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yaadbooks.com';
    const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}`;

    // Fire and forget — don't block registration on email delivery
    sendEmail({
      to: email,
      ...emailVerificationEmail({
        userName: firstName,
        verifyUrl,
      }),
    }).catch((err) => console.error('[Register] Failed to send verification email:', err));

    // Send welcome email (fire and forget)
    sendEmail({
      to: email,
      ...welcomeEmail({
        userName: firstName,
        companyName: companyName || 'your business',
      }),
    }).catch((err) => console.error('[Register] Failed to send welcome email:', err));

    // Generate access token (include both owned company and accepted invite companies)
    const companies = [
      ...(result.company ? [result.company.id] : []),
      ...(result.acceptedInvites ?? []),
    ];
    const activeCompanyId = result.company?.id ?? result.acceptedInvites?.[0] ?? null;
    const accessToken = await signAccessToken({
      sub: result.user.id,
      email: result.user.email,
      role: result.membership?.role ?? 'STAFF',
      activeCompanyId,
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
          activeCompanyId,
        },
        company: result.company
          ? { id: result.company.id, businessName: result.company.businessName }
          : null,
        acceptedInvites: result.acceptedInvites?.length ?? 0,
        accessToken,
      },
      { status: 201 }
    );

    // Set refresh token as httpOnly cookie
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshTokenCookieOptions());
    
    // Set access token cookie (httpOnly to prevent XSS token theft)
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes — matches JWT expiry
    });

    return response;
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Registration failed');
  }
}
