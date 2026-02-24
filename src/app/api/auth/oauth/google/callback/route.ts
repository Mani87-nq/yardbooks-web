/**
 * GET /api/auth/oauth/google/callback
 * Handles the Google OAuth 2.0 callback after user consents.
 *
 * Flow:
 * 1. Verify CSRF state token
 * 2. Exchange authorization code for tokens
 * 3. Fetch user profile from Google
 * 4. Find or create local user + OAuthAccount
 * 5. Issue JWT session tokens
 * 6. Redirect to dashboard
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  signAccessToken,
  signRefreshToken,
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenCookieOptions,
} from '@/lib/auth';
import { sendEmail } from '@/lib/email/service';
import { welcomeEmail } from '@/lib/email/templates';
import { encryptIfPresent } from '@/lib/encryption';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;           // Google's unique user ID
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // User denied access or error from Google
    if (error) {
      return NextResponse.redirect(
        `${appUrl}/login?error=google_oauth_denied`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${appUrl}/login?error=google_oauth_invalid`
      );
    }

    // Verify CSRF state
    const storedState = request.cookies.get('google_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        `${appUrl}/login?error=google_oauth_csrf`
      );
    }

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/auth/oauth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('[Google OAuth] Token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(
        `${appUrl}/login?error=google_oauth_token_failed`
      );
    }

    const tokens: GoogleTokenResponse = await tokenRes.json();

    // Fetch user profile
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      console.error('[Google OAuth] User info fetch failed:', await userInfoRes.text());
      return NextResponse.redirect(
        `${appUrl}/login?error=google_oauth_profile_failed`
      );
    }

    const googleUser: GoogleUserInfo = await userInfoRes.json();

    if (!googleUser.email) {
      return NextResponse.redirect(
        `${appUrl}/login?error=google_oauth_no_email`
      );
    }

    // ------- Find or create user -------

    let userId: string;
    let userEmail: string;
    let firstName: string;
    let lastName: string;
    let activeCompanyId: string | null = null;
    let companyIds: string[] = [];
    let memberRole = 'OWNER';
    let isNewUser = false;

    // Check if OAuth account already exists
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: googleUser.sub,
        },
      },
      include: {
        user: {
          include: {
            companyMemberships: { include: { company: true } },
          },
        },
      },
    });

    if (existingOAuth) {
      // Returning user — update tokens (encrypted at rest)
      await prisma.oAuthAccount.update({
        where: { id: existingOAuth.id },
        data: {
          accessToken: encryptIfPresent(tokens.access_token),
          refreshToken: tokens.refresh_token
            ? encryptIfPresent(tokens.refresh_token)
            : existingOAuth.refreshToken, // keep existing encrypted value
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });

      const user = existingOAuth.user;
      userId = user.id;
      userEmail = user.email;
      firstName = user.firstName;
      lastName = user.lastName;
      activeCompanyId = user.activeCompanyId;
      companyIds = user.companyMemberships.map((m) => m.companyId);
      memberRole = user.companyMemberships[0]?.role ?? 'OWNER';
    } else {
      // Reject Google accounts with unverified email to prevent account takeover
      if (!googleUser.email_verified) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('error', 'google_oauth_error');
        return NextResponse.redirect(loginUrl);
      }

      // Check if email matches an existing user (link accounts)
      const existingUser = await prisma.user.findUnique({
        where: { email: googleUser.email },
        include: {
          companyMemberships: { include: { company: true } },
        },
      });

      if (existingUser) {
        // Link Google account to existing user (tokens encrypted at rest)
        await prisma.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: 'google',
            providerAccountId: googleUser.sub,
            accessToken: encryptIfPresent(tokens.access_token),
            refreshToken: encryptIfPresent(tokens.refresh_token),
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          },
        });

        // Verify email if not already verified
        if (!existingUser.emailVerified) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              emailVerified: new Date(),
              avatarUrl: existingUser.avatarUrl || googleUser.picture || null,
            },
          });
        }

        userId = existingUser.id;
        userEmail = existingUser.email;
        firstName = existingUser.firstName;
        lastName = existingUser.lastName;
        activeCompanyId = existingUser.activeCompanyId;
        companyIds = existingUser.companyMemberships.map((m) => m.companyId);
        memberRole = existingUser.companyMemberships[0]?.role ?? 'OWNER';
      } else {
        // Brand new user — create user + company with 14-day trial
        isNewUser = true;
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const result = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: googleUser.email,
              passwordHash: null, // OAuth user — no password
              firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'User',
              lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
              emailVerified: new Date(), // Google verified the email
              avatarUrl: googleUser.picture || null,
            },
          });

          // Create default company with 14-day trial
          const company = await tx.company.create({
            data: {
              businessName: `${googleUser.given_name || 'My'}'s Business`,
              businessType: 'SOLE_PROPRIETOR',
              currency: 'JMD',
              subscriptionPlan: 'BUSINESS',
              subscriptionStatus: 'TRIALING',
              subscriptionStartDate: now,
              subscriptionEndDate: trialEnd,
            },
          });

          await tx.companyMember.create({
            data: {
              userId: newUser.id,
              companyId: company.id,
              role: 'OWNER',
            },
          });

          await tx.user.update({
            where: { id: newUser.id },
            data: { activeCompanyId: company.id },
          });

          await tx.oAuthAccount.create({
            data: {
              userId: newUser.id,
              provider: 'google',
              providerAccountId: googleUser.sub,
              accessToken: encryptIfPresent(tokens.access_token),
              refreshToken: encryptIfPresent(tokens.refresh_token),
              expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            },
          });

          return { user: newUser, company };
        });

        userId = result.user.id;
        userEmail = result.user.email;
        firstName = result.user.firstName;
        lastName = result.user.lastName;
        activeCompanyId = result.company.id;
        companyIds = [result.company.id];
        memberRole = 'OWNER';

        // Send welcome email (fire and forget)
        sendEmail({
          to: googleUser.email,
          ...welcomeEmail({
            userName: firstName,
            companyName: result.company.businessName,
          }),
        }).catch((err) => console.error('[Google OAuth] Failed to send welcome email:', err));
      }
    }

    // ------- Create session + JWT tokens -------

    // Delete existing sessions (single-session enforcement)
    await prisma.session.deleteMany({ where: { userId } });

    const accessToken = await signAccessToken({
      sub: userId,
      email: userEmail,
      role: memberRole as 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'READ_ONLY',
      activeCompanyId,
      companies: companyIds,
    });

    const session = await prisma.session.create({
      data: {
        userId,
        token: accessToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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

    // Update last login
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    // ------- Redirect to dashboard with tokens -------
    const response = NextResponse.redirect(`${appUrl}/dashboard`);

    // Set refresh token as httpOnly cookie
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshTokenCookieOptions());

    // Set access token cookie for middleware + client-side hydration.
    // NOT httpOnly so ensureAccessTokenFromCookie() can seed the in-memory
    // API client on the first dashboard load (same as login page behaviour).
    response.cookies.set('accessToken', accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes — matches JWT expiry
    });

    // Clear the CSRF state cookie
    response.cookies.delete('google_oauth_state');

    return response;
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    return NextResponse.redirect(
      `${appUrl}/login?error=google_oauth_error`
    );
  }
}
