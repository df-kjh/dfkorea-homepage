import { ADMIN_OPERATION_TIMEOUT_MESSAGE } from '../../utils/admin-operation-timeout'
import {
  createError,
  getCookie,
  getRequestHeader,
  setCookie,
  setResponseHeader,
  setResponseStatus,
  sendStream,
  type H3Event,
} from 'h3'

export interface AdminRelayConfig {
  adminApiBaseUrl: string
  adminOrigin: string
  production: boolean
}
export type RelayFetch = (url: string, init: RequestInit) => Promise<Response>
const PRODUCTION_API = 'https://dfkorea-production.up.railway.app'
const ID = '[A-Za-z0-9-]+'
// Only known administrator operations are relayed. Paths never select a host or protocol.
const ROUTES: Record<string, RegExp[]> = {
  GET: [
    /^auth\/session$/,
    /^tenders(?:\/(?:calendar|subscription|company-profile|award-results\/status|mail\/oauth\/status))?$/,
    new RegExp(`^tenders/${ID}(?:/analysis)?$`),
    new RegExp(`^quotes/admin(?:/${ID}(?:/attachments/${ID})?)?$`),
  ],
  POST: [
    /^auth\/(?:login|logout)$/,
    /^(?:products(?:\/generate-description)?|posts|certificates|upload\/(?:image|file))$/,
    /^scheduler\/trigger(?:\/product-company-news)?$/,
    /^tenders\/(?:collect|award-results\/backfill|mail\/oauth\/authorize)$/,
    new RegExp(`^tenders/${ID}/(?:analysis|review)$`),
    new RegExp(`^quotes/admin/${ID}/retry$`),
  ],
  PUT: [
    new RegExp(`^(?:products|posts|certificates)/${ID}$`),
    /^tenders\/(?:subscription|company-profile)$/,
  ],
  DELETE: [new RegExp(`^(?:products|posts|certificates)/${ID}$`), /^upload\/image$/],
}
const fail = (statusCode: number, statusMessage: string) =>
  createError({ statusCode, statusMessage })

async function readBody(event: H3Event, limit: number): Promise<Buffer> {
  const declared = getRequestHeader(event, 'content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw fail(413, 'Request too large')
  const chunks: Buffer[] = []
  let size = 0
  const webBody = event.web?.request?.body
  const source = webBody ?? event.node.req
  for await (const chunk of source as AsyncIterable<Uint8Array>) {
    const bytes = Buffer.from(chunk)
    size += bytes.length
    if (size > limit) throw fail(413, 'Request too large')
    chunks.push(bytes)
  }
  return Buffer.concat(chunks, size)
}

function validateConfig(config: AdminRelayConfig) {
  let api: URL
  let origin: URL
  try {
    api = new URL(config.adminApiBaseUrl)
    origin = new URL(config.adminOrigin)
  } catch {
    throw fail(503, 'Admin service unavailable')
  }
  const local = (url: URL) =>
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    ['http:', 'https:'].includes(url.protocol)
  if (
    api.origin !== config.adminApiBaseUrl ||
    origin.origin !== config.adminOrigin ||
    (config.adminApiBaseUrl !== PRODUCTION_API && (config.production || !local(api))) ||
    (origin.protocol !== 'https:' && (config.production || !local(origin)))
  ) {
    throw fail(503, 'Admin service unavailable')
  }
}

export const createAdminRelayHandler =
  (getConfig: () => AdminRelayConfig, fetcher: RelayFetch = globalThis.fetch) =>
  async (event: H3Event): Promise<unknown> => {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
    const config = getConfig()
    validateConfig(config)
    const method = event.method.toUpperCase()
    const [rawPath, query] = event.path.split('?', 2)
    const path = rawPath?.startsWith('/api/admin/') ? rawPath.slice('/api/admin/'.length) : ''
    if (!path || !ROUTES[method]?.some((pattern) => pattern.test(path)))
      throw fail(404, 'Not found')
    if (
      getRequestHeader(event, 'authorization') ||
      getRequestHeader(event, 'x-http-method-override')
    )
      throw fail(400, 'Invalid request')
    const origin = getRequestHeader(event, 'origin')
    const unsafe = !['GET', 'HEAD'].includes(method)
    if (
      (unsafe && origin !== config.adminOrigin) ||
      (origin && origin !== config.adminOrigin) ||
      (unsafe && getRequestHeader(event, 'sec-fetch-site') === 'cross-site')
    )
      throw fail(403, 'Forbidden')
    const secure = config.adminOrigin.startsWith('https://')
    const cookieName = secure ? '__Host-dfkorea_admin' : 'dfkorea_admin_dev'
    // OAuth returns through a cross-site top-level GET. Lax preserves its session;
    // unsafe requests still require the exact trusted Origin and fetch metadata above.
    const cookieOptions = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' }
    const clearSession = () => setCookie(event, cookieName, '', { ...cookieOptions, maxAge: 0 })
    if (path === 'auth/logout') {
      clearSession()
      return { success: true }
    }
    const token = getCookie(event, cookieName)
    if (
      path !== 'auth/login' &&
      (!token || token.length > 4096 || !/^[A-Za-z0-9_.-]+$/.test(token))
    )
      throw fail(401, 'Unauthorized')
    const headers: Record<string, string> = {}
    if (path !== 'auth/login') headers.Authorization = `Bearer ${token}`
    let body: Buffer | undefined
    if (unsafe) {
      const type = getRequestHeader(event, 'content-type') || ''
      const upload = method === 'POST' && path.startsWith('upload/')
      body = await readBody(
        event,
        upload ? 4 * 1024 * 1024 + 64 * 1024 : path === 'auth/login' ? 8192 : 1024 * 1024,
      )
      if (
        (body.length > 0 || path === 'auth/login' || upload) &&
        (upload ? !type.startsWith('multipart/form-data;') : !type.startsWith('application/json'))
      ) {
        throw fail(415, 'Unsupported media type')
      }
      if (type) headers['Content-Type'] = type
      if (path === 'auth/login') {
        let input: Record<string, unknown>
        try {
          input = JSON.parse(body.toString())
        } catch {
          throw fail(400, 'Invalid credentials')
        }
        if (
          !input ||
          typeof input.username !== 'string' ||
          !input.username.length ||
          input.username.length > 128 ||
          typeof input.password !== 'string' ||
          !input.password.length ||
          Buffer.byteLength(input.password) > 1024 ||
          Object.keys(input).some((key) => !['username', 'password'].includes(key))
        )
          throw fail(400, 'Invalid credentials')
      }
    }
    // These existing synchronous jobs can exceed one minute. Keep all other
    // requests bounded to 60s and leave 60s below Vercel's configured 300s ceiling.
    const longOperation =
      method === 'POST' &&
      [
        'scheduler/trigger',
        'scheduler/trigger/product-company-news',
        'tenders/collect',
        'products/generate-description',
      ].includes(path)
    const signal = AbortSignal.timeout(longOperation ? 240_000 : 60_000)
    const timeoutFailure = () =>
      createError({
        statusCode: 504,
        statusMessage: 'Gateway Timeout',
        message: ADMIN_OPERATION_TIMEOUT_MESSAGE,
        data: { code: 'ADMIN_OPERATION_TIMEOUT' },
      })
    const upstreamFailure = () =>
      signal.aborted ? timeoutFailure() : fail(502, 'Admin service unavailable')
    let response: Response
    try {
      response = await fetcher(`${config.adminApiBaseUrl}/${path}${query ? `?${query}` : ''}`, {
        method,
        headers,
        ...(body ? { body: new Uint8Array(body) } : {}),
        redirect: 'error',
        signal,
      })
    } catch {
      throw upstreamFailure()
    }
    if (!response.ok) {
      if (response.status === 504) throw timeoutFailure()
      if (response.status === 401) clearSession()
      // Upstream diagnostics may include internal data. Keep failures generic at this boundary.
      throw fail(
        response.status >= 400 && response.status <= 599 ? response.status : 502,
        response.status === 429
          ? 'Too many requests. Try again later.'
          : response.status === 401
            ? 'Unauthorized'
            : 'Request failed',
      )
    }
    if (path === 'auth/login') {
      let login: { access_token?: unknown; user?: { username?: unknown } }
      try {
        login = await response.json()
      } catch {
        throw fail(502, 'Invalid login response')
      }
      if (
        typeof login.access_token !== 'string' ||
        !/^[A-Za-z0-9_.-]{1,4096}$/.test(login.access_token) ||
        typeof login.user?.username !== 'string'
      )
        throw fail(502, 'Invalid login response')
      setCookie(event, cookieName, login.access_token, { ...cookieOptions, maxAge: 3600 })
      return { user: { username: login.user.username } }
    }
    setResponseStatus(event, response.status)
    for (const header of ['content-type', 'content-disposition']) {
      const value = response.headers.get(header)
      if (value) setResponseHeader(event, header, value)
    }
    // Streaming avoids buffering authenticated downloads through Vercel's normal
    // response payload limit. Only the known backend body and safe headers pass.
    try {
      return response.body ? await sendStream(event, response.body) : null
    } catch {
      throw upstreamFailure()
    }
  }
