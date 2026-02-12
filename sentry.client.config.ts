import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',

  // Sample 100% of errors, 10% of performance traces
  tracesSampleRate: 0.1,

  // Don't send PII (client names, emails) to Sentry
  sendDefaultPii: false,

  // Ignore common noise
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection captured',
    /^Loading chunk \d+ failed/,
  ],
});
