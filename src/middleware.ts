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
  '/legal/',              // Redirects to /terms and /privacy
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
  '/api/auth/oauth/google/callback',
  '/api/v1/billing/plans',
  '/api/billing/checkout',
  '/api/billing/webhook',
  '/api/health',
  '/api/chat',                       // Public AI chatbot (landing page)
  '/api/v1/contact',                 // Public contact form submission
  '/api/v1/referrals/validate',      // Public referral code validation (signup)
  '/api/v1/payments/wipay/callback', // WiPay callback redirect
  '/api/v1/payments/stripe/webhook', // Stripe per-company invoice payment webhook
  '/payment/',            // Payment result pages (success/failed/error)
  '/opengraph-image',     // OG image for social media previews (WhatsApp, Facebook, etc.)
  '/twitter-image',       // Twitter/X card image
  '/robots.txt',          // SEO: search engine crawl rules
  '/sitemap.xml',         // SEO: sitemap for search engines
  '/blog',                // SEO: public blog (listing + posts + OG images)
  '/accounting-software-jamaica',  // SEO: landing page
  '/pos-system-jamaica',           // SEO: landing page
  '/payroll-software-jamaica',     // SEO: landing page
  '/invoicing-software-jamaica',   // SEO: landing page
  '/employee',                     // Employee portal (kiosk login + authenticated pages)
  '/api/employee/auth',            // Terminal auth endpoints (PIN login, employee list, logout)
  '/api/employee/profile',         // Terminal profile (uses terminal JWT, not owner JWT)
  '/api/employee/clock-in',        // Terminal clock-in (uses terminal JWT)
  '/api/employee/clock-out',       // Terminal clock-out (uses terminal JWT)
  '/api/employee/shift',           // Terminal active shift (uses terminal JWT)
  '/api/employee/stats',           // Terminal stats (uses terminal JWT)
  '/api/employee/schedule',        // Terminal schedule (uses terminal JWT)
  '/api/employee/modules',         // Terminal active modules (uses terminal JWT)
  '/api/employee/terminal',        // Terminal registration (uses terminal JWT)
  '/api/employee/pos',              // Kiosk POS routes (uses terminal JWT)
];

// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================
  // SKIP RSC / PREFETCH REQUESTS
  // ============================================
  // Next.js App Router sends internal RSC requests for client-side navigation.
  // These carry a `Next-Router-State-Tree` header with URL-encoded state.
  // Passing modified request headers via NextResponse.next({ request: { headers } })
  // corrupts this header, causing "router state header could not be parsed" errors
  // and breaking ALL client-side navigation (Link clicks, router.push).
  // RSC requests already carry session cookies from the initial page load,
  // so they don't need middleware auth checks, CSP nonces, or security headers.
  if (
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') !== null ||
    request.headers.get('Next-Router-State-Tree') !== null ||
    request.nextUrl.searchParams.has('_rsc')
  ) {
    return NextResponse.next();
  }

  // ============================================
  // CSP NONCE — generated per request
  // ============================================
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  // ============================================
  // AUTHENTICATION CHECK
  // ============================================

  // Check if route is public
  // NOTE: '/' uses exact match; all other routes use prefix matching.
  const isPublicRoute =
    pathname === '/' ||
    PUBLIC_ROUTES.filter(r => r !== '/').some(route => pathname.startsWith(route)) ||
    // Invoice pay endpoint: /api/v1/invoices/[id]/pay (public for customer payments)
    /^\/api\/v1\/invoices\/[^/]+\/pay$/.test(pathname);
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
          const response = NextResponse.next({ request: { headers: requestHeaders } });

          // Set the new access token cookie (httpOnly to prevent XSS token theft)
          if (data.accessToken) {
            response.cookies.set('accessToken', data.accessToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 15 * 60, // 15 minutes — matches JWT expiry
            });
          }

          // Forward Set-Cookie headers from the refresh response (refresh token rotation)
          const setCookieHeaders = refreshRes.headers.getSetCookie?.() ?? [];
          for (const cookie of setCookieHeaders) {
            response.headers.append('Set-Cookie', cookie);
          }

          // Add security headers to this response
          addSecurityHeaders(response, nonce);
          return response;
        }
        // Refresh failed (session deleted or expired) → fall through to redirect
      } catch {
        // Network error during refresh — fall through to redirect
      }
    }
  }

  // Block unauthenticated users from protected routes
  if (!isPublicRoute && !isAuthenticated) {
    // API routes → return 401 JSON (clients expect JSON, not a redirect)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { type: 'unauthorized', title: 'Authentication required', status: 401, detail: 'Please log in.' },
        { status: 401 }
      );
    }

    // Page routes → redirect to login
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
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  addSecurityHeaders(response, nonce);
  return response;
}

// ============================================
// SECURITY HEADERS (extracted to avoid duplication)
// ============================================

function addSecurityHeaders(response: NextResponse, nonce: string) {
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

  // Content Security Policy — nonce-based for scripts (replaces unsafe-inline)
  // style-src keeps 'unsafe-inline' because Tailwind/CSS-in-JS requires it
  // and style injection is far lower risk than script injection.
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `media-src 'self'`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self' https://*.ingest.sentry.io https://us.i.posthog.com${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
}

// Apply to all routes except static assets and service worker
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|ogg|mp3|wav|pdf|woff|woff2|ttf|eot)$).*)',
  ],
};
