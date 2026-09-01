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
const QUERY_KEYS = [
  'type',
  'inqryDiv',
  'inqryBgnDt',
  'inqryEndDt',
  'pageNo',
  'numOfRows',
] as const
const TWELVE_DIGIT_DATE = /^\d{12}$/
const VALID_PAGE = /^(?:[1-9]|[1-9]\d|100)$/
const LOWERCASE_SHA256_HEX = /^[0-9a-f]{64}$/
const SIGNATURE_WINDOW_MS = 5 * 60 * 1000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactOwnKeys = (
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
) => {
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()

  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  )
}

const isAllowedOperation = (value: unknown): value is G2bRelayOperation =>
  typeof value === 'string' &&
  G2B_RELAY_OPERATIONS.some((operation) => operation === value)

export const validateRelayPayload = (value: unknown): G2bRelayRequest => {
  if (!isRecord(value) || !hasExactOwnKeys(value, PAYLOAD_KEYS)) {
    throw new Error('Invalid relay payload')
  }

  if (!isAllowedOperation(value.operation) || !isRecord(value.query)) {
    throw new Error('Invalid relay payload')
  }

  const query = value.query
  if (!hasExactOwnKeys(query, QUERY_KEYS)) {
    throw new Error('Invalid relay payload')
  }

  if (
    query.type !== 'json' ||
    query.inqryDiv !== '1' ||
    typeof query.inqryBgnDt !== 'string' ||
    !TWELVE_DIGIT_DATE.test(query.inqryBgnDt) ||
    typeof query.inqryEndDt !== 'string' ||
    !TWELVE_DIGIT_DATE.test(query.inqryEndDt) ||
    query.inqryBgnDt > query.inqryEndDt ||
    typeof query.pageNo !== 'string' ||
    !VALID_PAGE.test(query.pageNo) ||
    query.numOfRows !== '100'
  ) {
    throw new Error('Invalid relay payload')
  }

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

export interface VerifyRelaySignatureInput {
  body: string
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
  if (
    !secret ||
    !/^\d+$/.test(timestamp) ||
    !LOWERCASE_SHA256_HEX.test(signature)
  ) {
    return false
  }

  const timestampMs = Number(timestamp)
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(nowMs - timestampMs) > SIGNATURE_WINDOW_MS
  ) {
    return false
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest()
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
  const normalizedBaseUrl = new URL(baseUrl)
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
