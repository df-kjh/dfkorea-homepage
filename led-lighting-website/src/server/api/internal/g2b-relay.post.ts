import {
  createError,
  defineEventHandler,
  getRequestHeader,
  readRawBody,
  type H3Event,
} from 'h3'

import {
  buildG2bProviderUrl,
  validateRelayPayload,
  verifyRelaySignature,
} from '../../utils/g2b-relay'

const MAX_BODY_BYTES = 4 * 1024
const PROVIDER_TIMEOUT_MS = 10_000

interface G2bRelayRuntimeConfig {
  g2bRelaySharedSecret: string
  g2bTenderApiBaseUrl: string
  publicDataServiceKey: string
}

type RelayFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface G2bRelayHandlerDependencies {
  readRawBody(event: H3Event): Promise<string | undefined>
  getHeader(event: H3Event, name: string): string | undefined
  getRuntimeConfig(event: H3Event): G2bRelayRuntimeConfig
  fetcher: RelayFetcher
  now(): number
}

const relayUnavailable = () =>
  createError({ statusCode: 500, statusMessage: 'Relay unavailable' })

const invalidRequest = () =>
  createError({ statusCode: 400, statusMessage: 'Invalid request' })

const defaultDependencies: G2bRelayHandlerDependencies = {
  readRawBody: (event) => readRawBody(event),
  getHeader: getRequestHeader,
  getRuntimeConfig: (event) => {
    const config = useRuntimeConfig(event)
    return {
      g2bRelaySharedSecret: String(config.g2bRelaySharedSecret || ''),
      g2bTenderApiBaseUrl: String(config.g2bTenderApiBaseUrl || ''),
      publicDataServiceKey: String(config.publicDataServiceKey || ''),
    }
  },
  fetcher: globalThis.fetch,
  now: Date.now,
}

export const createG2bRelayHandler = (
  dependencies: G2bRelayHandlerDependencies = defaultDependencies,
) => {
  return async (event: H3Event): Promise<unknown> => {
    const config = dependencies.getRuntimeConfig(event)
    if (
      Buffer.byteLength(config.g2bRelaySharedSecret, 'utf8') < 32 ||
      !config.g2bTenderApiBaseUrl.trim() ||
      !config.publicDataServiceKey.trim()
    ) {
      throw relayUnavailable()
    }

    const contentLength = dependencies.getHeader(event, 'content-length')
    if (
      contentLength !== undefined &&
      (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)
    ) {
      throw invalidRequest()
    }

    let body: string | undefined
    try {
      body = await dependencies.readRawBody(event)
    } catch {
      throw invalidRequest()
    }
    if (!body || Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      throw invalidRequest()
    }

    const timestamp = dependencies.getHeader(event, 'x-dfkorea-timestamp') || ''
    const signature = dependencies.getHeader(event, 'x-dfkorea-signature') || ''
    if (
      !verifyRelaySignature({
        body,
        timestamp,
        signature,
        secret: config.g2bRelaySharedSecret,
        nowMs: dependencies.now(),
      })
    ) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    let payload: ReturnType<typeof validateRelayPayload>
    try {
      payload = validateRelayPayload(JSON.parse(body))
    } catch {
      throw invalidRequest()
    }

    let providerUrl: URL
    try {
      providerUrl = buildG2bProviderUrl({
        baseUrl: config.g2bTenderApiBaseUrl,
        serviceKey: config.publicDataServiceKey,
        request: payload,
      })
    } catch {
      throw relayUnavailable()
    }

    let response: Response
    try {
      response = await dependencies.fetcher(providerUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      })
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: 'Provider request failed',
      })
    }

    if (!response.ok) {
      // Provider bodies can contain implementation details and are deliberately
      // not consumed on failures so they cannot be copied into relay errors.
      throw createError({
        statusCode: 502,
        statusMessage: 'Provider request failed',
      })
    }

    try {
      return await response.json()
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: 'Provider response invalid',
      })
    }
  }
}

export default defineEventHandler(createG2bRelayHandler())
