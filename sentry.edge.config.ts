/**
 * Sentry edge runtime configuration.
 * This configures the Sentry SDK for Edge runtime (middleware).
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring
  tracesSampleRate: 0.1,

  // Environment
  environment: process.env.NODE_ENV,
});
