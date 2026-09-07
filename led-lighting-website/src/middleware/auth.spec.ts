import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let middleware: (to: { path: string }) => Promise<unknown>
let fetchSession: ReturnType<typeof vi.fn>
beforeEach(async () => {
  vi.resetModules()
  fetchSession = vi.fn()
  vi.stubGlobal('defineNuxtRouteMiddleware', (handler: unknown) => handler)
  vi.stubGlobal('useRequestFetch', () => fetchSession)
  vi.stubGlobal('navigateTo', (path: string) => ({ redirect: path }))
  middleware = (await import('./auth')).default as typeof middleware
})
afterEach(() => vi.unstubAllGlobals())

describe('admin navigation authentication', () => {
  it.each([401, 403, 502])(
    'redirects rejected sessions (%s) even with a forged legacy browser token',
    async (status) => {
      localStorage.setItem('admin_token', 'forged-admin-token')
      fetchSession.mockRejectedValue({ statusCode: status })
      expect(await middleware({ path: '/admin/dashboard' })).toEqual({ redirect: '/admin/login' })
      localStorage.removeItem('admin_token')
    },
  )
  it('allows a backend-validated session without any browser token', async () => {
    fetchSession.mockResolvedValue({ user: { username: 'admin' } })
    expect(await middleware({ path: '/admin/products/new' })).toBeUndefined()
    expect(fetchSession).toHaveBeenCalledWith('/api/admin/auth/session')
  })
  it.each(['/admin/login', '/products', '/blog/post-1'])('keeps %s public', async (path) => {
    expect(await middleware({ path })).toBeUndefined()
    expect(fetchSession).not.toHaveBeenCalled()
  })
})
