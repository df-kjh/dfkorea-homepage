import { describe, expect, it } from 'vitest'
import { securityHeaders } from './security-headers'

describe('frontend response security', () => {
  it.each(['/admin', '/admin/login', '/Admin/Settings', '/api/admin/auth/login'])(
    'prevents storing or indexing private route %s',
    (path) => {
      const headers = securityHeaders(path, true, 'https')
      expect(headers['Cache-Control']).toBe('no-store')
      expect(headers['X-Robots-Tag']).toBe('noindex, nofollow')
    },
  )

  it('leaves public caching intact while preventing framing and MIME sniffing', () => {
    const headers = securityHeaders('/products', true, 'https')
    expect(headers['Cache-Control']).toBeUndefined()
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Content-Security-Policy']).toBe("frame-ancestors 'none'")
  })

  it('emits HSTS only over production HTTPS', () => {
    expect(securityHeaders('/', true, 'https')['Strict-Transport-Security']).toBe(
      'max-age=31536000',
    )
    expect(securityHeaders('/', true, 'http')['Strict-Transport-Security']).toBeUndefined()
    expect(securityHeaders('/', false, 'https')['Strict-Transport-Security']).toBeUndefined()
  })
})
