import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
const api = vi.hoisted(() => ({
  session: vi.fn(),
  verify: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  submit: vi.fn(),
}))
vi.mock('@/api/quotes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/quotes')>()),
  quotesAPI: api,
}))
const company = {
  companyName: '테스트 회사',
  businessNumber: '123-45-67890',
  representativeName: '대표',
  openingDate: '2020-01-01',
  contactName: '담당',
  email: 'customer@example.com',
  phone: '',
}
const future = () => new Date(Date.now() + 3600000).toISOString()
function failure(status: number) {
  return new AxiosError('request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data: {},
    statusText: 'failed',
    headers: {},
    config: {} as never,
  })
}
async function controller() {
  const quote = (await import('./useQuoteDraft')).useQuoteDraft()
  Object.assign(quote.draft.company, company)
  quote.draft.session = {
    sessionToken: 'anonymous-only',
    expiresAt: future(),
    privacy: { version: 'v1', retentionDays: 365 },
  }
  quote.draft.verification = { verificationToken: 'verified-company', expiresAt: future() }
  quote.draft.consent = true
  quote.add({
    clientId: 'item1',
    kind: 'custom',
    name: '등기구',
    description: '옥외 설치',
    quantity: 1,
    options: [],
    certifications: [],
    attachmentIds: [],
  })
  return quote
}
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  api.session.mockResolvedValue({
    data: {
      sessionToken: 'renewed',
      expiresAt: future(),
      privacy: { version: 'v1', retentionDays: 365 },
    },
  })
  api.submit.mockResolvedValue({ data: { reference: 'DQ-one', status: 'RECEIVED' } })
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL() {
        return 'blob:local-photo'
      }
      static override revokeObjectURL() {}
    },
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('quote asynchronous draft lifecycle', () => {
  it('clears business verification as soon as its validity period expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-06T00:00:00.000Z'))
    const quote = await controller()
    quote.draft.verification = {
      verificationToken: 'short-lived',
      expiresAt: new Date(Date.now() + 1_000).toISOString(),
    }

    await vi.advanceTimersByTimeAsync(1_001)

    expect(quote.draft.verification).toBeNull()
    expect(quote.isVerified()).toBe(false)
  })

  it('uses one stable photo identity when an upload response is lost', async () => {
    const quote = await controller()
    quote.addPhoto('item1', new File(['a'], 'one.jpg', { type: 'image/jpeg' }))
    const identity = quote.draft.photos[0]!.clientId
    api.upload
      .mockRejectedValueOnce(new AxiosError('response lost'))
      .mockResolvedValueOnce({ data: { id: 'same-server-photo' } })
    await quote.submit()
    await quote.submit()
    expect(api.upload.mock.calls[0]![2]).toBe(identity)
    expect(api.upload.mock.calls[1]![2]).toBe(identity)
    expect(api.submit.mock.calls[0]![1].items[0].attachmentIds).toEqual(['same-server-photo'])
  })
  it('prevents submission while remote photo deletion is unresolved', async () => {
    const quote = await controller()
    quote.addPhoto('item1', new File(['a'], 'one.jpg', { type: 'image/jpeg' }))
    quote.draft.photos[0]!.attachmentId = 'old-photo'
    let resolve!: (value: unknown) => void
    api.remove.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const deleting = quote.removePhoto(quote.draft.photos[0]!.clientId)
    await quote.submit()
    expect(api.submit).not.toHaveBeenCalled()
    resolve({ data: { success: true } })
    await deleting
    await quote.submit()
    expect(api.submit.mock.calls[0]![1].items[0].attachmentIds).toEqual([])
  })
  it('keeps the original photo and identity after failed remote deletion', async () => {
    const quote = await controller()
    quote.addPhoto('item1', new File(['a'], 'one.jpg', { type: 'image/jpeg' }))
    quote.draft.photos[0]!.attachmentId = 'original'
    const identity = quote.draft.photos[0]!.clientId
    api.remove.mockRejectedValueOnce(new Error('offline'))
    await quote.replacePhoto(identity, new File(['b'], 'replacement.jpg', { type: 'image/jpeg' }))
    expect(quote.draft.photos).toHaveLength(1)
    expect(quote.draft.photos[0]!.clientId).toBe(identity)
    expect(quote.draft.photos[0]!.file.name).toBe('one.jpg')
    expect(quote.draft.busy).toBe(false)
  })

  it('ignores a verification result if registered company data changed while waiting', async () => {
    const quote = await controller()
    let resolve!: (value: unknown) => void
    api.verify.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = quote.verify()
    await vi.waitFor(() => expect(api.verify).toHaveBeenCalled())
    quote.updateCompany({ companyName: '수정한 회사' })
    resolve({ data: { verificationToken: 'stale', expiresAt: future() } })
    await pending
    expect(quote.draft.verification).toBeNull()
  })
  it('keeps the same key and request snapshot after an ambiguous timeout', async () => {
    const quote = await controller()
    api.submit.mockRejectedValueOnce(new AxiosError('timeout', 'ECONNABORTED'))
    await quote.submit()
    const original = JSON.parse(JSON.stringify(api.submit.mock.calls[0]![1]))
    expect(quote.draft.pendingSubmission).not.toBeNull()
    await quote.submit()
    expect(api.submit.mock.calls[1]![1]).toEqual(original)
    expect(quote.draft.reference).toBe('DQ-one')
  })
  it('unlocks a definitively rejected request for correction without clearing entered data', async () => {
    const quote = await controller()
    api.submit.mockRejectedValueOnce(failure(422))
    await quote.submit()
    expect(quote.draft.pendingSubmission).toBeNull()
    expect(quote.draft.idempotencyKey).toBe('')
    expect(quote.draft.company.companyName).toBe(company.companyName)
    expect(quote.draft.items).toHaveLength(1)
  })
  it('preserves uploaded photos and retries only the failed upload', async () => {
    const quote = await controller()
    quote.addPhoto('item1', new File(['a'], 'one.jpg', { type: 'image/jpeg' }))
    quote.addPhoto('item1', new File(['b'], 'two.jpg', { type: 'image/jpeg' }))
    api.upload
      .mockResolvedValueOnce({ data: { id: 'photo1' } })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: { id: 'photo2' } })
    await quote.submit()
    expect(quote.draft.photos[0]?.attachmentId).toBe('photo1')
    expect(quote.draft.photos).toHaveLength(2)
    expect(quote.draft.pendingSubmission).toBeNull()
    await quote.submit()
    expect(api.upload).toHaveBeenCalledTimes(3)
    expect(api.submit.mock.calls[0]![1].items[0].attachmentIds).toEqual(['photo1', 'photo2'])
  })
  it('does not upload photos for an unfinished custom item that is not in the request', async () => {
    const quote = await controller()
    quote.addPhoto('unfinished-item', new File(['a'], 'one.jpg', { type: 'image/jpeg' }))
    await quote.submit()
    expect(api.upload).not.toHaveBeenCalled()
    expect(api.submit.mock.calls[0]![1].items[0].attachmentIds).toEqual([])
  })
  it('does not renew an expired session while a previous submission result is unresolved', async () => {
    const quote = await controller()
    api.submit.mockRejectedValueOnce(new AxiosError('timeout'))
    await quote.submit()
    quote.draft.session!.expiresAt = '2000-01-01'
    await expect(quote.ensureSession()).rejects.toThrow()
    expect(api.session).not.toHaveBeenCalled()
    expect(quote.draft.session!.sessionToken).toBe('anonymous-only')
  })
  it('guards duplicate clicks while submitting', async () => {
    const quote = await controller()
    let resolve!: (value: unknown) => void
    api.submit.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const first = quote.submit()
    await quote.submit()
    expect(api.submit).toHaveBeenCalledTimes(1)
    resolve({ data: { reference: 'DQ-one', status: 'RECEIVED' } })
    await first
  })
  it('retains an uncertain submission when its session expires instead of resubmitting as a new session', async () => {
    const quote = await controller()
    api.submit.mockRejectedValueOnce(new AxiosError('timeout')).mockRejectedValueOnce(failure(401))
    await quote.submit()
    await quote.submit()
    expect(quote.draft.pendingSubmission).not.toBeNull()
    expect(api.session).not.toHaveBeenCalled()
    expect(quote.draft.reference).toBe('')
  })
})
