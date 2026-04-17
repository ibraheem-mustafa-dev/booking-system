import type { NextRequest } from 'next/server';

/**
 * Derive the user-facing base URL for redirects from an incoming request.
 *
 * Respects reverse-proxy headers so redirects preserve whichever domain the
 * user actually visited (book.smallgiantsstudio.co.uk, book.smallgiantsstudio.cloud,
 * etc.) rather than hard-coding to NEXT_PUBLIC_APP_URL.
 *
 * Fallback order:
 *   1. x-forwarded-host + x-forwarded-proto  (set by Nginx in production)
 *   2. host header                           (direct container access)
 *   3. NEXT_PUBLIC_APP_URL                   (configured canonical URL)
 *   4. request.nextUrl.origin                (Docker-internal, last resort)
 *
 * Why: request.nextUrl.origin returns the Docker-internal URL (0.0.0.0:3000)
 * behind the Nginx reverse proxy, and NEXT_PUBLIC_APP_URL is pinned to a single
 * domain — so alternate domain aliases get cross-redirected to the canonical one.
 *
 * Trust model: safe behind Cloudflare + Nginx (both sanitise forwarded headers).
 * Do NOT use on endpoints reachable without that reverse-proxy chain without
 * adding an allow-list.
 */
export function getRequestBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = forwardedHost ?? request.headers.get('host');

  if (host) {
    return `${forwardedProto}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
}
