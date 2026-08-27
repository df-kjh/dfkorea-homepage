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
