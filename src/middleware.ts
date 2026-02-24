/**
 * Next.js Middleware — runs on every request.
 * Handles authentication checks, transparent token refresh, and security headers.
 *
 * Single-session enforcement:
 *   When a user logs in from a new device, the server deletes all previous
 *   sessions. The old browser's 15-min access token eventually expires;
 *   this middleware detects the expiry, tries to refresh (which fails because
 *   the session was deleted), and redirects to /login.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, REFRESH_TOKEN_COOKIE } from '@/lib/auth/jwt';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',  // Landing page
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/privacy',
  '/terms',
  '/contact',
  '/billing/success',
  '/billing/cancelled',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/oauth/google',
  '/api/v1/billing/plans',
  '/api/billing/checkout',
  '/api/billing/webhook',
];

// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================
  // AUTHENTICATION CHECK
  // ============================================

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route));

  // Get access token from Authorization header or cookie
  let accessToken: string | null = null;
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7);
  } else {
    // Try to get from cookie (for client-side requests)
    accessToken = request.cookies.get('accessToken')?.value ?? null;
  }

  // Verify token
  let isAuthenticated = false;
  if (accessToken) {
    try {
      await verifyAccessToken(accessToken);
      isAuthenticated = true;
    } catch {
      // Token invalid or expired — try transparent refresh below
      isAuthenticated = false;
    }
  }

  // ============================================
  // TRANSPARENT TOKEN REFRESH
  // ============================================
  // If the access token expired but the refresh cookie exists,
  // attempt a server-side refresh. This keeps the session alive
  // when the 15-min access token expires. If the session was
  // deleted (single-session enforcement), the refresh will fail
  // and the user will be redirected to /login.
  if (!isAuthenticated && !isPublicRoute) {
    const refreshCookie = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshCookie) {
      try {
        const origin = request.nextUrl.origin;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s max

        const refreshRes = await fetch(`${origin}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Cookie': `${REFRESH_TOKEN_COOKIE}=${refreshCookie}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          isAuthenticated = true;

          // Forward the response and set the new cookies from the refresh endpoint
          const response = NextResponse.next();

          // Set the new access token cookie
          if (data.accessToken) {
            response.cookies.set('accessToken', data.accessToken, {
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 7 * 24 * 60 * 60,
            });
          }

          // Forward Set-Cookie headers from the refresh response (refresh token rotation)
          const setCookieHeaders = refreshRes.headers.getSetCookie?.() ?? [];
          for (const cookie of setCookieHeaders) {
            response.headers.append('Set-Cookie', cookie);
          }

          // Add security headers to this response
          addSecurityHeaders(response);
          return response;
        }
        // Refresh failed (session deleted or expired) → fall through to redirect
      } catch {
        // Network error during refresh — fall through to redirect
      }
    }
  }

  // Redirect unauthenticated users from protected routes
  if (!isPublicRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);

    // Clear stale cookies so the login page starts clean
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('accessToken');
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Continue with request and add security headers
  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

// ============================================
// SECURITY HEADERS (extracted to avoid duplication)
// ============================================

function addSecurityHeaders(response: NextResponse) {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS (only in production — enforces HTTPS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Permissions policy — restrict browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // Content Security Policy
  // In development, allow eval for Next.js hot-reload
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    `default-src 'self'`,
    `script-src 'self'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : " 'unsafe-inline'"}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self'${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
}

// Apply to all routes except static assets
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
