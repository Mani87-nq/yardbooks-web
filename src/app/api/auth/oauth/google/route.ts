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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const loginUrl = new URL('/login', appUrl);
    loginUrl.searchParams.set('error', 'google_oauth_not_configured');
    return NextResponse.redirect(loginUrl);
  }

  const url = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const redirectUri = `${appUrl}/api/auth/oauth/google/callback`;

  // Capture intent (signup vs login) to redirect errors back to the right page
  const intent = url.searchParams.get('intent') === 'signup' ? 'signup' : 'login';

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

  // Store state and intent in httpOnly cookies for CSRF verification and redirect target
  const response = NextResponse.redirect(googleAuthUrl.toString());
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });
  response.cookies.set('google_oauth_intent', intent, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  return response;
}
