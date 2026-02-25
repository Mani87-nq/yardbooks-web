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

    // Determine where to redirect errors: /signup or /login based on intent cookie
    const intent = request.cookies.get('google_oauth_intent')?.value;
    const errorPage = intent === 'signup' ? '/signup' : '/login';

    // User denied access or error from Google
    if (error) {
      return NextResponse.redirect(
        `${appUrl}${errorPage}?error=google_oauth_denied`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${appUrl}${errorPage}?error=google_oauth_invalid`
      );
    }

    // Verify CSRF state
    const storedState = request.cookies.get('google_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        `${appUrl}${errorPage}?error=google_oauth_csrf`
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
        `${appUrl}${errorPage}?error=google_oauth_token_failed`
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
        `${appUrl}${errorPage}?error=google_oauth_profile_failed`
      );
    }

    const googleUser: GoogleUserInfo = await userInfoRes.json();

    if (!googleUser.email) {
      return NextResponse.redirect(
        `${appUrl}${errorPage}?error=google_oauth_no_email`
      );
    }

    // ------- Find or create user -------
    console.log('[Google OAuth] Step 1: Google auth succeeded, finding/creating user for:', googleUser.email);

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

    console.log('[Google OAuth] Step 2: OAuth lookup complete, found:', !!existingOAuth);

    if (existingOAuth) {
      // Returning user — update tokens (encrypted at rest)
      console.log('[Google OAuth] Step 3a: Updating tokens for returning user:', existingOAuth.user.email);
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
      console.log('[Google OAuth] Step 3a: Returning user tokens updated successfully');
    } else {
      console.log('[Google OAuth] Step 3b: No existing OAuth, checking for email match');
      // Reject Google accounts with unverified email to prevent account takeover
      if (!googleUser.email_verified) {
        const redirectUrl = new URL(errorPage, request.url);
        redirectUrl.searchParams.set('error', 'google_oauth_error');
        return NextResponse.redirect(redirectUrl);
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
    console.log('[Google OAuth] Step 4: Creating session for userId:', userId);

    // Delete existing sessions (single-session enforcement)
    await prisma.session.deleteMany({ where: { userId } });

    console.log('[Google OAuth] Step 5: Signing access token...');
    const accessToken = await signAccessToken({
      sub: userId,
      email: userEmail,
      role: memberRole as 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'READ_ONLY',
      activeCompanyId,
      companies: companyIds,
    });
    console.log('[Google OAuth] Step 5: Access token signed OK');

    console.log('[Google OAuth] Step 6: Creating session record...');
    const session = await prisma.session.create({
      data: {
        userId,
        token: accessToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        userAgent: request.headers.get('user-agent') ?? undefined,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      },
    });

    console.log('[Google OAuth] Step 7: Signing refresh token...');
    const refreshToken = await signRefreshToken({
      sub: userId,
      sessionId: session.id,
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken },
    });
    console.log('[Google OAuth] Step 7: Session fully created');

    // Update last login
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    console.log('[Google OAuth] Step 8: Last login updated, redirecting...');

    // ------- Redirect: new users → onboarding, returning → dashboard -------
    const redirectPath = isNewUser ? '/onboarding' : '/dashboard';
    const response = NextResponse.redirect(`${appUrl}${redirectPath}`);

    // Set refresh token as httpOnly cookie
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshTokenCookieOptions());

    // Set access token cookie (httpOnly to prevent XSS token theft).
    // The browser sends this cookie automatically with same-origin requests;
    // getAuthUser() in auth middleware reads it server-side.
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes — matches JWT expiry
    });

    // Clear OAuth cookies
    response.cookies.delete('google_oauth_state');
    response.cookies.delete('google_oauth_intent');

    return response;
  } catch (error) {
    // Enhanced logging to diagnose Google OAuth failures
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : 'no stack';
    const errName = error instanceof Error ? error.name : 'unknown';
    console.error(`[Google OAuth] Callback FATAL — ${errName}: ${errMsg}`);
    console.error(`[Google OAuth] Stack: ${errStack}`);

    // Read intent from cookie in outer catch (errorPage may not be defined here)
    const intent = request.cookies.get('google_oauth_intent')?.value;
    const fallbackPage = intent === 'signup' ? '/signup' : '/login';
    return NextResponse.redirect(
      `${appUrl}${fallbackPage}?error=google_oauth_error`
    );
  }
}
