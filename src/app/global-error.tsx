'use client';

/**
 * Next.js global error boundary — catches errors in the root layout itself.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#f9fafb',
        }}>
          <div style={{ maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '3.75rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginTop: '1rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
              A critical error occurred. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                textAlign: 'left',
                fontSize: '0.875rem',
                color: '#991b1b',
                overflow: 'auto',
                maxHeight: '12rem',
              }}>
                {error.message}
              </pre>
            )}
            <button
              onClick={reset}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
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
