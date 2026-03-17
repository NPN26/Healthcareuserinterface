/**
 * HTTPS Enforcement — redirects insecure HTTP connections to HTTPS
 * in production. Runs synchronously before the React tree mounts.
 *
 * While Vercel's HSTS header handles repeat visitors, this runtime
 * check catches the very first visit on plain HTTP and any edge cases
 * where the header might not yet be cached.
 */

import { logHttpsRedirect } from './securityLogger';

export function enforceHttps(): void {
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1')
  ) {
    logHttpsRedirect();
    window.location.replace(
      `https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`
    );
  }
}
