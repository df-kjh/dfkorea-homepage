import { afterEach, describe, expect, it, vi } from 'vitest'
import apiClient from './client'

describe('apiClient server safety', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not read browser storage while an SSR request is prepared', async () => {
    vi.stubGlobal('localStorage', undefined)

    await expect(
      apiClient.get('/ssr-safe-request', {
        adapter: async (config) => ({
          data: null,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      }),
    ).resolves.toMatchObject({ status: 200 })
  })

  it('does not redirect with window when an SSR 401 response is handled', async () => {
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('window', undefined)

    await expect(
      apiClient.get('/ssr-safe-401', {
        adapter: () => Promise.reject({ response: { status: 401 } }),
      }),
    ).rejects.toMatchObject({ response: { status: 401 } })
  })
})

describe('admin session transport', () => {
  it('sends admin writes to same-origin relay without browser bearer tokens', async () => {
    localStorage.setItem('admin_token', 'legacy-exposed-token')
    const response = await apiClient.post(
      '/products',
      {},
      {
        adapter: async (config) => ({
          data: { baseURL: config.baseURL, authorization: config.headers.Authorization },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      },
    )
    expect(response.data).toEqual({ baseURL: '/api/admin', authorization: undefined })
    expect(localStorage.getItem('admin_token')).toBeNull()
  })
})

describe('public content compatibility', () => {
  it.each([
    '/products',
    '/products/product-1',
    '/products/featured/list',
    '/posts',
    '/posts/post-1',
    '/certificates',
    '/certificates/cert-1',
  ])('keeps %s available without an admin session during SSR', async (path) => {
    vi.stubGlobal('localStorage', undefined)
    try {
      const response = await apiClient.get(path, {
        adapter: async (config) => ({
          data: { baseURL: config.baseURL, authorization: config.headers.Authorization },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      })
      expect(response.data).toEqual({ baseURL: 'http://localhost:3000', authorization: undefined })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
