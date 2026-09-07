// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createAdminRelayHandler } from './admin-relay'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
describe('bounded synchronous admin operations', () => {
  it.each([
    ['scheduler/trigger', 240_000],
    ['scheduler/trigger/product-company-news', 240_000],
    ['tenders/collect', 240_000],
    ['products/generate-description', 240_000],
    ['products', 60_000],
  ])(
    'keeps %s running until its bounded deadline and reports uncertain completion',
    async (path, deadline) => {
      vi.useFakeTimers()
      vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
        const controller = new AbortController()
        setTimeout(
          () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
          milliseconds,
        )
        return controller.signal
      })
      let calls = 0
      const handler = createAdminRelayHandler(
        () => ({
          adminApiBaseUrl: 'https://dfkorea-production.up.railway.app',
          adminOrigin: 'https://dfkorealed.com',
          production: true,
        }),
        async (_url, init) => {
          calls++
          return new Promise((_resolve, reject) =>
            init.signal!.addEventListener('abort', () => reject(init.signal!.reason), {
              once: true,
            }),
          )
        },
      )
      const req = {
        method: 'POST',
        url: `/api/admin/${path}`,
        headers: { origin: 'https://dfkorealed.com', cookie: '__Host-dfkorea_admin=token' },
        async *[Symbol.asyncIterator]() {
          /* Bodyless existing synchronous operations are valid. */
        },
      } as unknown as IncomingMessage
      const res = { setHeader() {}, getHeader() {} } as unknown as ServerResponse
      let completed = false
      const outcome = handler(createEvent(req, res))
        .then(
          (value) => ({ value }),
          (error) => ({ error }),
        )
        .finally(() => {
          completed = true
        })
      await vi.advanceTimersByTimeAsync(deadline - 1)
      expect(completed).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(await outcome).toMatchObject({
        error: {
          statusCode: 504,
          message: expect.stringContaining('완료 여부를 확인하지 못했습니다'),
        },
      })
      expect(calls).toBe(1)
    },
  )
})
