// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { createApp, eventHandler, toNodeListener } from 'h3'
import { createAdminRelayHandler, type AdminRelayConfig, type RelayFetch } from './admin-relay'

const origin = 'https://dfkorealed.com'
let server: Server
let address: string
let requests: { url: string; init: RequestInit }[]
let upstream: Response
let config: AdminRelayConfig
const call = (path: string, init: RequestInit = {}) => fetch(address + '/api/admin/' + path, init)
const headers = (extra: Record<string, string> = {}) => ({
  origin,
  cookie: '__Host-dfkorea_admin=secret-upstream-jwt',
  ...extra,
})
beforeEach(async () => {
  requests = []
  config = {
    adminApiBaseUrl: 'https://dfkorea-production.up.railway.app',
    adminOrigin: origin,
    production: true,
  }
  upstream = new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })
  const fetcher: RelayFetch = async (url, init) => {
    requests.push({ url, init })
    return upstream
  }
  const app = createApp().use(eventHandler(createAdminRelayHandler(() => config, fetcher)))
  server = createServer(toNodeListener(app))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  address = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterEach(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('same-origin admin relay', () => {
  it('keeps login bearer out of JSON and stores only an HttpOnly secure lax cookie', async () => {
    upstream = Response.json({ access_token: 'sensitive-bearer', user: { username: 'admin' } })
    const response = await call('auth/login', {
      method: 'POST',
      headers: headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ username: 'admin', password: 'test-password' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user: { username: 'admin' } })
    expect(response.headers.get('set-cookie')).toMatch(
      /__Host-dfkorea_admin=sensitive-bearer;.*Path=\/;.*HttpOnly;.*Secure;.*SameSite=Lax/i,
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(requests[0]?.init.headers).not.toHaveProperty('Authorization')
  })
  it.each([
    undefined,
    'https://attacker.example',
    'https://dfkorealed.com.attacker.example',
    'null',
  ])('rejects unsafe requests from %s before upstream', async (badOrigin) => {
    const response = await call('products', {
      method: 'POST',
      headers: {
        cookie: '__Host-dfkorea_admin=token',
        ...(badOrigin ? { origin: badOrigin } : {}),
      },
      body: '{}',
    })
    expect(response.status).toBe(403)
    expect(requests).toHaveLength(0)
  })
  it('keeps the session on a cross-site OAuth callback navigation forwarded by SSR', async () => {
    upstream = Response.json({ user: { username: 'admin' } })
    const response = await call('auth/session', {
      headers: {
        cookie: '__Host-dfkorea_admin=secret-upstream-jwt',
        'sec-fetch-site': 'cross-site',
      },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user: { username: 'admin' } })
    expect(requests[0]?.init.headers).toEqual({ Authorization: 'Bearer secret-upstream-jwt' })
  })
  it('still rejects unsafe cross-site fetch metadata even with a matching Origin', async () => {
    const response = await call('products', {
      method: 'POST',
      headers: headers({ 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' }),
      body: '{}',
    })
    expect(response.status).toBe(403)
    expect(requests).toHaveLength(0)
  })
  it('still rejects safe cross-origin fetches with an explicit foreign Origin', async () => {
    const response = await call('auth/session', {
      headers: headers({ origin: 'https://attacker.example' }),
    })
    expect(response.status).toBe(403)
    expect(requests).toHaveLength(0)
  })
  it('requires session cookies for protected reads and rejects supplied bearer overrides', async () => {
    expect((await call('tenders')).status).toBe(401)
    expect(
      (await call('tenders', { headers: headers({ authorization: 'Bearer attacker' }) })).status,
    ).toBe(400)
    expect(requests).toHaveLength(0)
  })
  it.each([
    'auth/other',
    'https://attacker.example',
    'tenders/mail/oauth/callback',
    'products/one/extra',
    '%2e%2e/quotes',
    'quotes/sessions',
  ])('rejects unapproved upstream path %s', async (path) => {
    expect((await call(path, { headers: headers() })).status).toBe(404)
    expect(requests).toHaveLength(0)
  })
  it('forwards only cookie authorization, original multipart bytes and safe headers', async () => {
    const body =
      '--test-boundary\r\nContent-Disposition: form-data; name="image"; filename="x.png"\r\n\r\npng-bytes\r\n--test-boundary--'
    const response = await call('upload/image?folder=products', {
      method: 'POST',
      headers: headers({
        'content-type': 'multipart/form-data; boundary=test-boundary',
        'x-forwarded-for': 'attacker-ip',
      }),
      body,
    })
    expect(response.status).toBe(200)
    expect(requests[0]?.url).toBe(
      'https://dfkorea-production.up.railway.app/upload/image?folder=products',
    )
    expect(requests[0]?.init.headers).toEqual({
      Authorization: 'Bearer secret-upstream-jwt',
      'Content-Type': 'multipart/form-data; boundary=test-boundary',
    })
    expect(Buffer.from(requests[0]!.init.body as Uint8Array).toString()).toBe(body)
    expect(requests[0]?.init.redirect).toBe('error')
  })
  it.each([
    ['scheduler/trigger', 'POST'],
    ['tenders/collect', 'POST'],
    ['products/p-1', 'DELETE'],
  ])('preserves bodyless %s operations', async (path, method) => {
    const response = await call(path!, { method, headers: headers() })
    expect(response.status).toBe(200)
  })
  it('preserves JSON upload deletion', async () => {
    const response = await call('upload/image', {
      method: 'DELETE',
      headers: headers({ 'content-type': 'application/json' }),
      body: '{"url":"https://cdn.example/products/photo.png"}',
    })
    expect(response.status).toBe(200)
  })
  it('preserves protected attachment download bytes and disposition', async () => {
    upstream = new Response(new Uint8Array([0, 255, 65]), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="quote.pdf"',
        'set-cookie': 'upstream=must-not-pass',
      },
    })
    const response = await call('quotes/admin/q-1/attachments/a-1', { headers: headers() })
    expect(response.status).toBe(200)
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0, 255, 65])
    expect(response.headers.get('content-disposition')).toContain('quote.pdf')
    expect(response.headers.get('set-cookie')).toBeNull()
  })
  it('clears expired sessions without copying upstream errors', async () => {
    upstream = new Response('private diagnostic', { status: 401 })
    const response = await call('auth/session', { headers: headers() })
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(await response.text()).not.toContain('private diagnostic')
  })
  it.each([
    'https://attacker.example',
    'http://127.0.0.1:3000',
    'https://dfkorea-production.up.railway.app/extra',
  ])('fails closed for production upstream override %s', async (upstreamUrl) => {
    config.adminApiBaseUrl = upstreamUrl
    expect((await call('tenders', { headers: headers() })).status).toBe(503)
    expect(requests).toHaveLength(0)
  })
  it('rejects oversized login bodies before contacting upstream', async () => {
    const response = await call('auth/login', {
      method: 'POST',
      headers: headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ username: 'admin', password: 'a'.repeat(9000) }),
    })
    expect(response.status).toBe(413)
    expect(requests).toHaveLength(0)
  })
  it('rejects attempts to override HTTP method before contacting upstream', async () => {
    expect(
      (await call('tenders', { headers: headers({ 'x-http-method-override': 'DELETE' }) })).status,
    ).toBe(400)
    expect(requests).toHaveLength(0)
  })
  it('logs out by expiring the HttpOnly session cookie with no upstream token response', async () => {
    const response = await call('auth/logout', { method: 'POST', headers: headers() })
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(requests).toHaveLength(0)
  })
})
