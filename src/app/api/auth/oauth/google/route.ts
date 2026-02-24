/**
 * GET /api/auth/oauth/google
 * Initiates Google OAuth 2.0 Authorization Code flow.
 * Redirects the user to Google's consent screen.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;

  if (!clientId) {
    // Not configured — redirect back to login with error
    const { origin } = new URL(request.url);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'google_oauth_not_configured');
    return NextResponse.redirect(loginUrl);
  }

  const { origin } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const redirectUri = `${appUrl}/api/auth/oauth/google/callback`;

  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString('hex');

  // Build Google OAuth URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');
  googleAuthUrl.searchParams.set('state', state);

  // Store state in httpOnly cookie for CSRF verification
  const response = NextResponse.redirect(googleAuthUrl.toString());
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  return response;
}
