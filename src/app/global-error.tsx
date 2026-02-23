'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          background: '#f9fafb',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              background: '#059669',
              color: 'white',
              fontWeight: 700,
              fontSize: '22px',
              borderRadius: '16px',
              marginBottom: '24px',
            }}>
              YB
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#6b7280', lineHeight: 1.6, marginBottom: '24px' }}>
              We have been notified and are looking into it. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '12px 24px',
                background: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
