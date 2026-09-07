export function securityHeaders(
  path: string,
  production: boolean,
  protocol: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // A framing-only policy leaves Nuxt hydration, the editor and WebGL resources compatible.
    'Content-Security-Policy': "frame-ancestors 'none'",
  }
  if (production && protocol === 'https') headers['Strict-Transport-Security'] = 'max-age=31536000'
  if (/^\/(?:api\/)?admin(?:\/|$)/i.test(path)) {
    headers['Cache-Control'] = 'no-store'
    headers['X-Robots-Tag'] = 'noindex, nofollow'
  }
  return headers
}
