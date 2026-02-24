/**
 * Sentry edge runtime configuration.
 * This configures the Sentry SDK for Edge runtime (middleware).
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://cfd1aae269281a7b4f6ba780a3a5f051@o4510890857725952.ingest.us.sentry.io/4510938305069056',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring
  tracesSampleRate: 0.1,

  // Environment
  environment: process.env.NODE_ENV,
});
