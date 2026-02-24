/**
 * Sentry server-side configuration.
 * This configures the Sentry SDK for the Node.js runtime.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://cfd1aae269281a7b4f6ba780a3a5f051@o4510890857725952.ingest.us.sentry.io/4510938305069056',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Environment
  environment: process.env.NODE_ENV,

  // Filter out noise
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],

  beforeSend(event) {
    // Strip sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-forwarded-for'];
    }

    return event;
  },
});
