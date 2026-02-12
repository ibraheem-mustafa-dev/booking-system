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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Something went wrong</h1>
          <p style={{ color: '#666', marginBottom: '1.5rem', textAlign: 'center', maxWidth: '400px' }}>
            An unexpected error occurred. The issue has been reported automatically.
          </p>
          <button
            onClick={reset}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1B6B6B', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem', minHeight: '44px', minWidth: '44px' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
