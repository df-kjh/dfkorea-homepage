/**
 * Returns the API origin embedded in the client and server bundles.
 * Localhost is intentionally available only during Vite development; a
 * production bundle without an explicit public API URL must fail loudly.
 */
export const getApiBaseUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim()

  if (configuredUrl) {
    return configuredUrl
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:3000'
  }

  throw new Error('VITE_API_BASE_URL is required for production builds')
}
