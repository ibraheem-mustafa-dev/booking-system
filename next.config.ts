import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment
  output: 'standalone',

  // Enable experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '10mb', // For audio file uploads
    },
  },

  // Image optimisation
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
    ],
  },

  // Headers for embedding (CORS for widget + iframe)
  async headers() {
    const iframeHeaders = [
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self' https://smallgiantsstudio.co.uk https://*.smallgiantsstudio.co.uk https://*.smallgiantsstudio.cloud",
      },
      { key: 'X-Frame-Options', value: 'ALLOWALL' },
    ];

    return [
      // Allow iframe embedding on public booking pages
      {
        source: '/book/:path*',
        headers: iframeHeaders,
      },
      {
        source: '/:typeSlug((?!dashboard|api|login|callback|_next).*)',
        headers: iframeHeaders,
      },
      // Block iframe embedding on dashboard
      {
        source: '/dashboard/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
      // API CORS
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      // Widget assets
      {
        source: '/widget/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,
  // Upload source maps for better error traces in production
  widenClientFileUpload: true,
  // Disable Sentry telemetry
  telemetry: false,
});
