import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/oauth/google
 * Initiates Google OAuth flow
 * 
 * For now, this returns a placeholder until Google OAuth is configured in the database
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  
  // TODO: Implement actual Google OAuth when ready
  // For now, redirect back to login with a message
  const loginUrl = new URL('/login', origin);
  loginUrl.searchParams.set('message', 'google_oauth_coming_soon');
  
  return NextResponse.redirect(loginUrl);
}
