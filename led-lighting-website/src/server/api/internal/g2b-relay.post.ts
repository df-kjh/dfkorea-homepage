import { createError, defineEventHandler, getRequestHeader, type H3Event } from 'h3'

import {
  buildG2bProviderUrl,
  parseAndValidateRelayPayload,
  verifyRelaySignature,
} from '../../utils/g2b-relay'

const MAX_BODY_BYTES = 4 * 1024
const PROVIDER_TIMEOUT_MS = 10_000

interface G2bRelayRuntimeConfig {
  g2bRelaySharedSecret: string
  g2bTenderApiBaseUrl: string
  publicDataServiceKey: string
}

type RelayFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface G2bRelayHandlerDependencies {
  readBody(event: H3Event, maximumBytes: number): Promise<Buffer>
  getHeader(event: H3Event, name: string): string | undefined
  getRuntimeConfig(event: H3Event): G2bRelayRuntimeConfig
  fetcher: RelayFetcher
  now(): number
}

const relayUnavailable = () => createError({ statusCode: 500, statusMessage: 'Relay unavailable' })

const invalidRequest = () => createError({ statusCode: 400, statusMessage: 'Invalid request' })

const toBuffer = (chunk: unknown): Buffer => {
  if (Buffer.isBuffer(chunk)) return chunk
  if (typeof chunk === 'string') return Buffer.from(chunk)
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
  }
  if (chunk instanceof ArrayBuffer) return Buffer.from(chunk)
  throw new Error('Invalid request body chunk')
}

const readWebBody = async (
  stream: ReadableStream<Uint8Array>,
  maximumBytes: number,
): Promise<Buffer> => {
  const reader = stream.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return Buffer.concat(chunks, totalBytes)

      const chunk = toBuffer(value)
      totalBytes += chunk.byteLength
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined)
        throw new Error('Request body too large')
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }
}

export const readBoundedRequestBody = async (
  event: H3Event,
  maximumBytes: number,
): Promise<Buffer> => {
  const webStream = event.web?.request?.body
  if (webStream) return readWebBody(webStream, maximumBytes)

  const request = event.node?.req
  if (!request || !(Symbol.asyncIterator in request)) {
    throw new Error('Request body unavailable')
  }

  const chunks: Buffer[] = []
  let totalBytes = 0
  for await (const value of request) {
    const chunk = toBuffer(value)
    totalBytes += chunk.byteLength
    if (totalBytes > maximumBytes) {
      request.destroy()
      throw new Error('Request body too large')
    }
    chunks.push(chunk)
  }

  return Buffer.concat(chunks, totalBytes)
}

const defaultDependencies: G2bRelayHandlerDependencies = {
  readBody: readBoundedRequestBody,
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

    let body: Buffer
    try {
      body = await dependencies.readBody(event, MAX_BODY_BYTES)
    } catch {
      throw invalidRequest()
    }
    if (body.byteLength === 0 || body.byteLength > MAX_BODY_BYTES) {
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

    let payload: ReturnType<typeof parseAndValidateRelayPayload>
    try {
      payload = parseAndValidateRelayPayload(body)
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
        redirect: 'error',
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
        statusCode:
          Number.isInteger(response.status) && response.status >= 400 && response.status <= 599
            ? response.status
            : 502,
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
