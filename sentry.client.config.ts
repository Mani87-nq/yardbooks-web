/**
 * Sentry client-side configuration.
 * This configures the Sentry SDK for the browser.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session replay for debugging
  replaysSessionSampleRate: 0.01, // 1% of sessions
  replaysOnErrorSampleRate: 0.5, // 50% of sessions with errors

  // Environment
  environment: process.env.NODE_ENV,

  // Filter out noise
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'fb_xd_fragment',
    // Network errors (normal offline behavior)
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    // Benign errors
    'ResizeObserver loop',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
  ],

  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV !== 'production') return null;

    // Strip sensitive data from URLs
    if (event.request?.url) {
      try {
        const url = new URL(event.request.url);
        url.searchParams.delete('token');
        url.searchParams.delete('session_id');
        event.request.url = url.toString();
      } catch {
        // Ignore URL parse errors
      }
    }

    return event;
  },
});
