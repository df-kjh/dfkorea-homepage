import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createG2bRelayHandler,
  readBoundedRequestBody,
} from './g2b-relay.post'

const body = JSON.stringify({
  operation: 'getBidPblancListInfoThng',
  query: {
    type: 'json',
    inqryDiv: '1',
    inqryBgnDt: '202608311500',
    inqryEndDt: '202609010633',
    pageNo: '1',
    numOfRows: '100',
  },
})
const timestamp = '1788222791000'
const nowMs = 1788222791000
const sharedSecret = 'relay-test-secret-with-at-least-32-bytes'
const signature = createHmac('sha256', sharedSecret)
  .update(`${timestamp}.${body}`)
  .digest('hex')

const runtimeConfig = {
  g2bRelaySharedSecret: sharedSecret,
  g2bTenderApiBaseUrl:
    'https://apis.data.go.kr/1230000/ad/BidPublicInfoService',
  publicDataServiceKey: 'vercel-key',
}

const createDependencies = (
  overrides: Partial<Parameters<typeof createG2bRelayHandler>[0]> = {},
) => ({
  readBody: vi.fn().mockResolvedValue(Buffer.from(body)),
  getHeader: vi.fn((_event, name: string) => {
    if (name === 'x-dfkorea-timestamp') return timestamp
    if (name === 'x-dfkorea-signature') return signature
    return undefined
  }),
  getRuntimeConfig: vi.fn(() => runtimeConfig),
  fetcher: vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
          body: { items: [], pageNo: 1, numOfRows: 100, totalCount: 0 },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  ),
  now: () => nowMs,
  ...overrides,
})

describe('POST /api/internal/g2b-relay', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns generic 400 for malformed JSON without calling upstream', async () => {
    const malformedBody = '{not-json'
    const dependencies = createDependencies({
      readBody: vi.fn().mockResolvedValue(Buffer.from(malformedBody)),
      getHeader: vi.fn((_event, name: string) => {
        if (name === 'x-dfkorea-timestamp') return timestamp
        if (name === 'x-dfkorea-signature') {
          return createHmac('sha256', sharedSecret)
            .update(`${timestamp}.${malformedBody}`)
            .digest('hex')
        }
        return undefined
      }),
    })
    const handler = createG2bRelayHandler(dependencies)

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid request',
    })
    expect(dependencies.fetcher).not.toHaveBeenCalled()
  })

  it('rejects a body larger than 4 KiB before calling upstream', async () => {
    const oversizedBody = 'x'.repeat(4097)
    const dependencies = createDependencies({
      readBody: vi.fn().mockResolvedValue(Buffer.from(oversizedBody)),
      getHeader: vi.fn((_event, name: string) => {
        if (name === 'x-dfkorea-timestamp') return timestamp
        if (name === 'x-dfkorea-signature') {
          return createHmac('sha256', sharedSecret)
            .update(`${timestamp}.${oversizedBody}`)
            .digest('hex')
        }
        return undefined
      }),
    })
    const handler = createG2bRelayHandler(dependencies)

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid request',
    })
    expect(dependencies.fetcher).not.toHaveBeenCalled()
  })

  it.each([
    ['an invalid signature', '0'.repeat(64), timestamp],
    [
      'an expired timestamp',
      createHmac('sha256', sharedSecret)
        .update(`${nowMs - 300_001}.${body}`)
        .digest('hex'),
      String(nowMs - 300_001),
    ],
  ])('returns generic 401 for %s', async (_description, suppliedSignature, suppliedTimestamp) => {
    const dependencies = createDependencies({
      getHeader: vi.fn((_event, name: string) => {
        if (name === 'x-dfkorea-timestamp') return suppliedTimestamp
        if (name === 'x-dfkorea-signature') return suppliedSignature
        return undefined
      }),
    })
    const handler = createG2bRelayHandler(dependencies)

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
    expect(dependencies.fetcher).not.toHaveBeenCalled()
  })

  it('returns generic 400 for an authenticated but invalid payload', async () => {
    const invalidBody = JSON.stringify({ ...JSON.parse(body), extra: true })
    const dependencies = createDependencies({
      readBody: vi.fn().mockResolvedValue(Buffer.from(invalidBody)),
      getHeader: vi.fn((_event, name: string) => {
        if (name === 'x-dfkorea-timestamp') return timestamp
        if (name === 'x-dfkorea-signature') {
          return createHmac('sha256', sharedSecret)
            .update(`${timestamp}.${invalidBody}`)
            .digest('hex')
        }
        return undefined
      }),
    })
    const handler = createG2bRelayHandler(dependencies)

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid request',
    })
    expect(dependencies.fetcher).not.toHaveBeenCalled()
  })

  it.each([
    [
      'top-level operation',
      `{"operation":"getEverything","operation":"getBidPblancListInfoThng","query":${JSON.stringify(JSON.parse(body).query)}}`,
    ],
    [
      'nested query type',
      '{"operation":"getBidPblancListInfoThng","query":{"type":"xml","type":"json","inqryDiv":"1","inqryBgnDt":"202608311500","inqryEndDt":"202609010633","pageNo":"1","numOfRows":"100"}}',
    ],
  ])('returns generic 400 for duplicate %s keys', async (_description, duplicateBody) => {
    const duplicateSignature = createHmac('sha256', sharedSecret)
      .update(timestamp)
      .update('.')
      .update(Buffer.from(duplicateBody))
      .digest('hex')
    const dependencies = createDependencies({
      readBody: vi.fn().mockResolvedValue(Buffer.from(duplicateBody)),
      getHeader: vi.fn((_event, name: string) => {
        if (name === 'x-dfkorea-timestamp') return timestamp
        if (name === 'x-dfkorea-signature') return duplicateSignature
        return undefined
      }),
    })
    const handler = createG2bRelayHandler(dependencies)

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid request',
    })
    expect(dependencies.fetcher).not.toHaveBeenCalled()
  })

  it.each([
    ['g2bRelaySharedSecret', ''],
    ['g2bRelaySharedSecret', 'too-short'],
    ['g2bTenderApiBaseUrl', ''],
    ['publicDataServiceKey', ''],
  ] as const)('returns generic 500 when %s is missing', async (key, value) => {
    const dependencies = createDependencies({
      getRuntimeConfig: vi.fn(() => ({ ...runtimeConfig, [key]: value })),
    })
    const handler = createG2bRelayHandler(dependencies)

    const rejectedResponse = await handler({} as never).catch((error) => error)

    expect(rejectedResponse).toMatchObject({
      statusCode: 500,
      statusMessage: 'Relay unavailable',
    })
    expect(JSON.stringify(rejectedResponse)).not.toContain('vercel-key')
    expect(JSON.stringify(rejectedResponse)).not.toContain(sharedSecret)
    expect(dependencies.fetcher).not.toHaveBeenCalled()
  })

  it('makes one bounded provider request and forwards its JSON response', async () => {
    const providerJson = {
      response: {
        header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
        body: { items: [{ bidNtceNo: '2026-1' }], pageNo: 1, numOfRows: 100, totalCount: 1 },
      },
    }
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(providerJson), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const dependencies = createDependencies({ fetcher })
    const handler = createG2bRelayHandler(dependencies)

    await expect(handler({} as never)).resolves.toEqual(providerJson)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [input, init] = fetcher.mock.calls[0]!
    expect(String(input)).toContain('serviceKey=vercel-key')
    expect(String(input)).not.toContain('client-key')
    expect(init).toMatchObject({ method: 'GET' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns a generic status-only error without reading or leaking an upstream failure body', async () => {
    const providerBody = 'provider secret body'
    const text = vi.fn().mockResolvedValue(providerBody)
    const json = vi.fn().mockRejectedValue(new Error(providerBody))
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text,
      json,
    } as unknown as Response)
    const dependencies = createDependencies({ fetcher })
    const handler = createG2bRelayHandler(dependencies)

    const rejectedResponse = await handler({} as never).catch((error) => error)

    expect(rejectedResponse).toMatchObject({
      statusCode: 502,
      statusMessage: 'Provider request failed',
    })
    expect(text).not.toHaveBeenCalled()
    expect(json).not.toHaveBeenCalled()
    expect(JSON.stringify(rejectedResponse)).not.toContain('vercel-key')
    expect(JSON.stringify(rejectedResponse)).not.toContain(providerBody)
  })
})

describe('readBoundedRequestBody', () => {
  it('cancels a multi-chunk stream at byte 4097 without pulling remaining chunks', async () => {
    const chunks = [
      new Uint8Array(2048),
      new Uint8Array(2048),
      new Uint8Array(1),
      new TextEncoder().encode('must-not-be-read'),
    ]
    let pulls = 0
    let cancelled = false
    const bodyStream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          const chunk = chunks[pulls]
          pulls += 1
          if (chunk) controller.enqueue(chunk)
          else controller.close()
        },
        cancel() {
          cancelled = true
        },
      },
      { highWaterMark: 0 },
    )
    const event = {
      method: 'POST',
      web: { request: { body: bodyStream } },
    }

    await expect(readBoundedRequestBody(event as never, 4096)).rejects.toThrow()
    expect(cancelled).toBe(true)
    expect(pulls).toBe(3)
  })
})
