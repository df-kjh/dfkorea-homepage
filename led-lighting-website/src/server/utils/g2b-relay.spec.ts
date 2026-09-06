import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  buildG2bProviderUrl,
  parseAndValidateRelayPayload,
  validateRelayPayload,
  verifyRelaySignature,
} from './g2b-relay'

const validPayload = {
  operation: 'getBidPblancListInfoThng',
  query: {
    type: 'json',
    inqryDiv: '1',
    inqryBgnDt: '202608311500',
    inqryEndDt: '202609010633',
    pageNo: '1',
    numOfRows: '100',
  },
} as const

const enrichmentOperations = [
  'getBidPblancListInfoThng',
  'getBidPblancListInfoThngBsisAmount',
  'getBidPblancListInfoLicenseLimit',
  'getBidPblancListInfoPrtcptPsblRgn',
  'getBidPblancListInfoThngPurchsObjPrdct',
] as const

const enrichmentOperationsWithRevision = new Set([
  'getBidPblancListInfoLicenseLimit',
  'getBidPblancListInfoPrtcptPsblRgn',
  'getBidPblancListInfoThngPurchsObjPrdct',
])

const enrichmentPayload = (operation: (typeof enrichmentOperations)[number]) => {
  const query: Record<string, string> = {
    type: 'json',
    inqryDiv: '2',
    bidNtceNo: 'R26BK01000001',
    pageNo: '1',
    numOfRows: '100',
  }
  if (enrichmentOperationsWithRevision.has(operation)) query.bidNtceOrd = '000'
  return { operation, query }
}

const body = JSON.stringify(validPayload)
const timestamp = '1788222791000'
const nowMs = 1788222791000
const secret = 'relay-test-secret-with-at-least-32-bytes'

const sign = (timestampValue: string, bodyValue: string) =>
  createHmac('sha256', secret).update(`${timestampValue}.${bodyValue}`).digest('hex')

describe('validateRelayPayload', () => {
  it('keeps accepting the bounded G2B goods-list operation', () => {
    expect(validateRelayPayload(validPayload).operation).toBe('getBidPblancListInfoThng')
  })

  it.each(enrichmentOperations)(
    'accepts the bounded goods enrichment operation %s',
    (operation) => {
      expect(validateRelayPayload(enrichmentPayload(operation))).toEqual(
        enrichmentPayload(operation),
      )
    },
  )

  it.each([
    ['a service-key field', { serviceKey: 'client-key' }],
    ['a date-window field', { inqryBgnDt: '202609010000' }],
    ['a notice-revision field unsupported by the basis operation', { bidNtceOrd: '000' }],
    ['an unknown field', { arbitrary: 'value' }],
  ])('rejects enrichment payload with %s', (_label, queryExtension) => {
    const candidate = enrichmentPayload('getBidPblancListInfoThngBsisAmount')
    expect(() =>
      validateRelayPayload({
        ...candidate,
        query: { ...candidate.query, ...queryExtension },
      }),
    ).toThrow()
  })

  it.each([
    ['inquiry division', { inqryDiv: '1' }],
    ['notice number', { bidNtceNo: '' }],
    ['notice revision', { bidNtceOrd: '0000' }],
    ['page number', { pageNo: '2' }],
  ])('rejects enrichment payload with invalid %s', (_label, queryReplacement) => {
    const candidate = enrichmentPayload('getBidPblancListInfoLicenseLimit')
    expect(() =>
      validateRelayPayload({
        ...candidate,
        query: { ...candidate.query, ...queryReplacement },
      }),
    ).toThrow()
  })

  it.each([
    ['an unknown top-level field', { ...validPayload, extra: true }],
    [
      'an unknown query field',
      { ...validPayload, query: { ...validPayload.query, serviceKey: 'client-key' } },
    ],
    ['an unknown operation', { ...validPayload, operation: 'getEverything' }],
    ['a construction operation', { ...validPayload, operation: 'getBidPblancListInfoCnstwk' }],
    ['a service operation', { ...validPayload, operation: 'getBidPblancListInfoServc' }],
    [
      'a missing query field',
      {
        ...validPayload,
        query: {
          type: 'json',
          inqryDiv: '1',
          inqryBgnDt: '202608311500',
          inqryEndDt: '202609010633',
          pageNo: '1',
        },
      },
    ],
    [
      'an invalid start date',
      { ...validPayload, query: { ...validPayload.query, inqryBgnDt: '2026-08-31' } },
    ],
    [
      'an invalid end date',
      { ...validPayload, query: { ...validPayload.query, inqryEndDt: '20260901063x' } },
    ],
    [
      'a reversed date window',
      {
        ...validPayload,
        query: {
          ...validPayload.query,
          inqryBgnDt: '202609010634',
          inqryEndDt: '202609010633',
        },
      },
    ],
    ['page zero', { ...validPayload, query: { ...validPayload.query, pageNo: '0' } }],
    ['page 101', { ...validPayload, query: { ...validPayload.query, pageNo: '101' } }],
    ['a decimal page', { ...validPayload, query: { ...validPayload.query, pageNo: '1.5' } }],
    ['a non-100 row count', { ...validPayload, query: { ...validPayload.query, numOfRows: '99' } }],
    ['a non-json type', { ...validPayload, query: { ...validPayload.query, type: 'xml' } }],
    [
      'another inquiry division',
      { ...validPayload, query: { ...validPayload.query, inqryDiv: '2' } },
    ],
  ])('rejects %s', (_description, candidate) => {
    expect(() => validateRelayPayload(candidate)).toThrow()
  })
})

describe('parseAndValidateRelayPayload', () => {
  it('accepts a valid raw JSON payload', () => {
    expect(parseAndValidateRelayPayload(Buffer.from(body))).toEqual(validPayload)
  })

  it.each([
    [
      'top-level key',
      `{"operation":"getEverything","operation":"getBidPblancListInfoThng","query":${JSON.stringify(validPayload.query)}}`,
    ],
    [
      'nested query key',
      '{"operation":"getBidPblancListInfoThng","query":{"type":"xml","type":"json","inqryDiv":"1","inqryBgnDt":"202608311500","inqryEndDt":"202609010633","pageNo":"1","numOfRows":"100"}}',
    ],
  ])('rejects a duplicate %s even when its final value is valid', (_description, rawBody) => {
    expect(() => parseAndValidateRelayPayload(Buffer.from(rawBody))).toThrow()
  })
})

describe('verifyRelaySignature', () => {
  it('accepts a matching signature over the exact timestamp and body', () => {
    expect(
      verifyRelaySignature({
        body,
        timestamp,
        signature: sign(timestamp, body),
        secret,
        nowMs,
      }),
    ).toBe(true)
  })

  it.each([
    ['an expired timestamp', String(nowMs - 300_001), sign(String(nowMs - 300_001), body)],
    ['a future timestamp', String(nowMs + 300_001), sign(String(nowMs + 300_001), body)],
    ['a non-decimal timestamp', 'not-a-time', sign('not-a-time', body)],
    ['a short hex signature', timestamp, 'ab12'],
    ['a non-hex signature', timestamp, 'z'.repeat(64)],
    ['an uppercase signature', timestamp, sign(timestamp, body).toUpperCase()],
  ])('rejects %s', (_description, timestampValue, signature) => {
    expect(
      verifyRelaySignature({
        body,
        timestamp: timestampValue,
        signature,
        secret,
        nowMs,
      }),
    ).toBe(false)
  })

  it('rejects a signature when any exact body byte changes', () => {
    expect(
      verifyRelaySignature({
        body: `${body} `,
        timestamp,
        signature: sign(timestamp, body),
        secret,
        nowMs,
      }),
    ).toBe(false)
  })

  it('authenticates the exact raw bytes without UTF-8 replacement', () => {
    const rawBody = Buffer.from([0xff, 0x00, 0x61])
    const rawSignature = createHmac('sha256', secret)
      .update(timestamp)
      .update('.')
      .update(rawBody)
      .digest('hex')

    expect(
      verifyRelaySignature({
        body: rawBody,
        timestamp,
        signature: rawSignature,
        secret,
        nowMs,
      }),
    ).toBe(true)
  })
})

describe('buildG2bProviderUrl', () => {
  it('sets only validated query fields and one Vercel-owned service key', () => {
    const url = buildG2bProviderUrl({
      baseUrl:
        'https://apis.data.go.kr/1230000/ad/BidPublicInfoService?serviceKey=client-a&serviceKey=client-b&extra=discard-me',
      serviceKey: 'vercel-key',
      request: validateRelayPayload(validPayload),
    })

    expect(url.origin).toBe('https://apis.data.go.kr')
    expect(url.pathname).toBe('/1230000/ad/BidPublicInfoService/getBidPblancListInfoThng')
    expect([...url.searchParams.keys()]).toEqual([
      'type',
      'inqryDiv',
      'inqryBgnDt',
      'inqryEndDt',
      'pageNo',
      'numOfRows',
      'serviceKey',
    ])
    expect(url.searchParams.getAll('serviceKey')).toEqual(['vercel-key'])
    expect(url.searchParams.has('extra')).toBe(false)
  })

  it('builds a goods enrichment URL with only the fixed notice query and Vercel key', () => {
    const request = validateRelayPayload(
      enrichmentPayload('getBidPblancListInfoThngPurchsObjPrdct'),
    )
    const url = buildG2bProviderUrl({
      baseUrl: 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService',
      serviceKey: 'vercel-key',
      request,
    })

    expect(url.pathname).toBe(
      '/1230000/ad/BidPublicInfoService/getBidPblancListInfoThngPurchsObjPrdct',
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      type: 'json',
      inqryDiv: '2',
      bidNtceNo: 'R26BK01000001',
      bidNtceOrd: '000',
      pageNo: '1',
      numOfRows: '100',
      serviceKey: 'vercel-key',
    })
  })

  it.each([
    ['a non-HTTPS provider base', 'http://apis.data.go.kr/1230000/ad/BidPublicInfoService'],
    [
      'a credentialed provider base',
      'https://provider-user:provider-password@apis.data.go.kr/1230000/ad/BidPublicInfoService',
    ],
    [
      'a different provider host',
      'https://apis.data.go.kr.example.test/1230000/ad/BidPublicInfoService',
    ],
    ['a different provider path', 'https://apis.data.go.kr/1230000/ad/AnotherService'],
    [
      'an appended provider path',
      'https://apis.data.go.kr/1230000/ad/BidPublicInfoService/unapproved',
    ],
  ])('rejects %s with a generic error', (_description, baseUrl) => {
    let rejected: unknown
    try {
      buildG2bProviderUrl({
        baseUrl,
        serviceKey: 'vercel-key',
        request: validateRelayPayload(validPayload),
      })
    } catch (error) {
      rejected = error
    }

    expect(rejected).toMatchObject({ message: 'Invalid provider configuration' })
    expect(JSON.stringify(rejected)).not.toContain(baseUrl)
    expect(JSON.stringify(rejected)).not.toContain('provider-user')
    expect(JSON.stringify(rejected)).not.toContain('provider-password')
  })
})

describe('award relay routes', () => {
  it.each(['getScsbidListSttusThng', 'getOpengResultListInfoThngPreparPcDetail'] as const)(
    'routes %s only to official Scsbid goods path',
    (operation) => {
      const query =
        operation === 'getScsbidListSttusThng'
          ? { ...validPayload.query, pageNo: '101' }
          : {
              type: 'json',
              inqryDiv: '2',
              bidNtceNo: 'R26BK01000001',
              pageNo: '1',
              numOfRows: '100',
            }
      const request = validateRelayPayload({ operation, query })
      expect(request).toEqual({ operation, query })
      const url = buildG2bProviderUrl({
        baseUrl: 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService',
        serviceKey: 'fixture-key',
        request,
      })
      expect(url.pathname).toBe(`/1230000/as/ScsbidInfoService/${operation}`)
      expect(url.searchParams.get('serviceKey')).toBe('fixture-key')
      expect(() =>
        validateRelayPayload({ operation, query: { ...query, bidwinnrBizno: '123' } }),
      ).toThrow()
    },
  )
  it('rejects other award operations and unbounded pages', () => {
    expect(() =>
      validateRelayPayload({ ...validPayload, operation: 'getScsbidListSttusCnstwk' }),
    ).toThrow()
    expect(() =>
      validateRelayPayload({
        ...validPayload,
        operation: 'getScsbidListSttusThng',
        query: { ...validPayload.query, pageNo: '1000001' },
      }),
    ).toThrow()
  })
})
