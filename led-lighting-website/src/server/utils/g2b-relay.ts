import { createHmac, timingSafeEqual } from 'node:crypto'

export const G2B_RELAY_OPERATIONS = [
  'getBidPblancListInfoCnstwk',
  'getBidPblancListInfoThng',
  'getBidPblancListInfoServc',
] as const

export type G2bRelayOperation = (typeof G2B_RELAY_OPERATIONS)[number]

export interface G2bRelayRequest {
  operation: G2bRelayOperation
  query: {
    type: 'json'
    inqryDiv: '1'
    inqryBgnDt: string
    inqryEndDt: string
    pageNo: string
    numOfRows: '100'
  }
}

const PAYLOAD_KEYS = ['operation', 'query'] as const
const QUERY_KEYS = ['type', 'inqryDiv', 'inqryBgnDt', 'inqryEndDt', 'pageNo', 'numOfRows'] as const
const TWELVE_DIGIT_DATE = /^\d{12}$/
const VALID_PAGE = /^(?:[1-9]|[1-9]\d|100)$/
const LOWERCASE_SHA256_HEX = /^[0-9a-f]{64}$/
const SIGNATURE_WINDOW_MS = 5 * 60 * 1000
const OFFICIAL_G2B_HOST = 'apis.data.go.kr'
const OFFICIAL_G2B_PATH_PREFIX = '/1230000/ad/BidPublicInfoService'

export type RelayPayloadRejectionReason =
  | 'top_level_keys'
  | 'operation'
  | 'query_keys'
  | 'type'
  | 'inquiry_division'
  | 'begin_date'
  | 'end_date'
  | 'date_order'
  | 'page_no'
  | 'row_count'

export class RelayPayloadValidationError extends Error {
  constructor(readonly reason: RelayPayloadRejectionReason) {
    super('Invalid relay payload')
  }
}

const rejectPayload = (reason: RelayPayloadRejectionReason): never => {
  throw new RelayPayloadValidationError(reason)
}

class JsonObjectKeyScanner {
  private index = 0

  constructor(private readonly source: string) {}

  assertNoDuplicateKeys(): void {
    this.skipWhitespace()
    this.scanValue()
    this.skipWhitespace()
    if (this.index !== this.source.length) {
      throw new Error('Invalid relay payload')
    }
  }

  private scanValue(): void {
    this.skipWhitespace()
    const token = this.source[this.index]
    if (token === '{') {
      this.scanObject()
      return
    }
    if (token === '[') {
      this.scanArray()
      return
    }
    if (token === '"') {
      this.scanString()
      return
    }

    const start = this.index
    while (this.index < this.source.length && !/[\s,}\]]/.test(this.source[this.index]!)) {
      this.index += 1
    }
    if (this.index === start) {
      throw new Error('Invalid relay payload')
    }
  }

  private scanObject(): void {
    this.index += 1
    this.skipWhitespace()
    const keys = new Set<string>()
    if (this.consume('}')) return

    while (true) {
      this.skipWhitespace()
      if (this.source[this.index] !== '"') {
        throw new Error('Invalid relay payload')
      }
      const key = this.scanString()
      if (keys.has(key)) {
        throw new Error('Invalid relay payload')
      }
      keys.add(key)

      this.skipWhitespace()
      if (!this.consume(':')) {
        throw new Error('Invalid relay payload')
      }
      this.scanValue()
      this.skipWhitespace()
      if (this.consume('}')) return
      if (!this.consume(',')) {
        throw new Error('Invalid relay payload')
      }
    }
  }

  private scanArray(): void {
    this.index += 1
    this.skipWhitespace()
    if (this.consume(']')) return

    while (true) {
      this.scanValue()
      this.skipWhitespace()
      if (this.consume(']')) return
      if (!this.consume(',')) {
        throw new Error('Invalid relay payload')
      }
    }
  }

  private scanString(): string {
    const start = this.index
    this.index += 1

    while (this.index < this.source.length) {
      const token = this.source[this.index]
      if (token === '\\') {
        this.index += 2
        continue
      }
      this.index += 1
      if (token === '"') {
        return JSON.parse(this.source.slice(start, this.index)) as string
      }
    }

    throw new Error('Invalid relay payload')
  }

  private consume(token: string): boolean {
    if (this.source[this.index] !== token) return false
    this.index += 1
    return true
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.source[this.index] || '')) {
      this.index += 1
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactOwnKeys = (value: Record<string, unknown>, expectedKeys: readonly string[]) => {
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()

  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  )
}

const isAllowedOperation = (value: unknown): value is G2bRelayOperation =>
  typeof value === 'string' && G2B_RELAY_OPERATIONS.some((operation) => operation === value)

export const validateRelayPayload = (value: unknown): G2bRelayRequest => {
  if (!isRecord(value) || !hasExactOwnKeys(value, PAYLOAD_KEYS)) {
    return rejectPayload('top_level_keys')
  }

  if (!isAllowedOperation(value.operation) || !isRecord(value.query)) {
    return rejectPayload('operation')
  }

  const query = value.query
  if (!hasExactOwnKeys(query, QUERY_KEYS)) {
    return rejectPayload('query_keys')
  }

  if (query.type !== 'json') return rejectPayload('type')
  if (query.inqryDiv !== '1') return rejectPayload('inquiry_division')
  if (typeof query.inqryBgnDt !== 'string' || !TWELVE_DIGIT_DATE.test(query.inqryBgnDt)) {
    return rejectPayload('begin_date')
  }
  if (typeof query.inqryEndDt !== 'string' || !TWELVE_DIGIT_DATE.test(query.inqryEndDt)) {
    return rejectPayload('end_date')
  }
  if (query.inqryBgnDt > query.inqryEndDt) return rejectPayload('date_order')
  if (typeof query.pageNo !== 'string' || !VALID_PAGE.test(query.pageNo)) {
    return rejectPayload('page_no')
  }
  if (query.numOfRows !== '100') return rejectPayload('row_count')

  return {
    operation: value.operation,
    query: {
      type: query.type,
      inqryDiv: query.inqryDiv,
      inqryBgnDt: query.inqryBgnDt,
      inqryEndDt: query.inqryEndDt,
      pageNo: query.pageNo,
      numOfRows: query.numOfRows,
    },
  }
}

export const parseAndValidateRelayPayload = (rawBody: Uint8Array): G2bRelayRequest => {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(rawBody)
  new JsonObjectKeyScanner(source).assertNoDuplicateKeys()
  return validateRelayPayload(JSON.parse(source))
}

export interface VerifyRelaySignatureInput {
  body: string | Uint8Array
  timestamp: string
  signature: string
  secret: string
  nowMs?: number
}

export const verifyRelaySignature = ({
  body,
  timestamp,
  signature,
  secret,
  nowMs = Date.now(),
}: VerifyRelaySignatureInput): boolean => {
  if (!secret || !/^\d+$/.test(timestamp) || !LOWERCASE_SHA256_HEX.test(signature)) {
    return false
  }

  const timestampMs = Number(timestamp)
  if (!Number.isSafeInteger(timestampMs) || Math.abs(nowMs - timestampMs) > SIGNATURE_WINDOW_MS) {
    return false
  }

  const expected = createHmac('sha256', secret).update(timestamp).update('.').update(body).digest()
  const actual = Buffer.from(signature, 'hex')

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export interface BuildG2bProviderUrlInput {
  baseUrl: string
  serviceKey: string
  request: G2bRelayRequest
}

export const buildG2bProviderUrl = ({
  baseUrl,
  serviceKey,
  request,
}: BuildG2bProviderUrlInput): URL => {
  let normalizedBaseUrl: URL
  try {
    normalizedBaseUrl = new URL(baseUrl)
    const pathname = normalizedBaseUrl.pathname.replace(/\/+$/, '')
    if (
      normalizedBaseUrl.protocol !== 'https:' ||
      normalizedBaseUrl.host !== OFFICIAL_G2B_HOST ||
      normalizedBaseUrl.username !== '' ||
      normalizedBaseUrl.password !== '' ||
      (pathname !== OFFICIAL_G2B_PATH_PREFIX &&
        !pathname.startsWith(`${OFFICIAL_G2B_PATH_PREFIX}/`))
    ) {
      throw new Error()
    }
  } catch {
    throw new Error('Invalid provider configuration')
  }
  normalizedBaseUrl.search = ''
  normalizedBaseUrl.hash = ''
  normalizedBaseUrl.pathname = `${normalizedBaseUrl.pathname.replace(/\/+$/, '')}/`

  const url = new URL(request.operation, normalizedBaseUrl)
  for (const field of QUERY_KEYS) {
    url.searchParams.set(field, request.query[field])
  }
  url.searchParams.set('serviceKey', serviceKey)

  return url
}
