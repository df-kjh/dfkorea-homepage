import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getCalendar: vi.fn(),
  getAll: vi.fn(),
  getOne: vi.fn(),
  collect: vi.fn(),
  getSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  getMailOAuthStatus: vi.fn(),
  authorizeMailOAuth: vi.fn(),
}))

vi.mock('@/api/tenders', () => ({ tendersAPI: api }))

import TenderManagement from './TenderManagement.vue'

const tender = {
  id: 'tender-1',
  source: 'G2B' as const,
  sourceNoticeId: 'R26BK0001',
  revision: '000',
  title: '서울 LED 조명 교체',
  orderingOrganization: '서울시',
  demandOrganization: null,
  registeredAt: '2026-08-27T09:00:00.000Z',
  bidStartedAt: null,
  bidEndedAt: '2026-09-02T09:00:00.000Z',
  openedAt: null,
  region: '서울',
  procurementType: 'GOODS' as const,
  contractMethod: null,
  estimatedAmount: '5000000',
  sourceUrl: 'https://example.go.kr/tenders/1',
  relevance: 'DIRECT' as const,
  relevanceScore: 100,
  relevanceReasons: [{ field: 'title', keyword: 'LED', score: 100 }],
  opportunityType: 'GOODS_SUPPLY' as const,
  opportunityReasons: ['물품 업무구분'],
}

const listResponse = {
  data: [tender],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const closeSubscriptionModal = () => {
  const closeButton = document.body.querySelector<HTMLButtonElement>('[aria-label="모달 닫기"]')
  if (!closeButton) throw new Error('Expected subscription modal close button')
  closeButton.click()
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []
const mountTenderManagement = (attachToBody = false) => {
  const wrapper = mount(
    TenderManagement,
    attachToBody ? { attachTo: document.body } : {},
  )
  mountedWrappers.push(wrapper)
  return wrapper
}
const cleanupMountedWrappers = () => {
  const wrappers = mountedWrappers.splice(0).reverse()
  for (const wrapper of wrappers) wrapper.unmount()
}

describe('TenderManagement', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-27T12:00:00.000Z'))
    vi.resetAllMocks()
    api.getCalendar.mockResolvedValue({ data: [{ date: '2026-08-27', total: 1, direct: 1, potential: 0 }] })
    api.getAll.mockResolvedValue({ data: listResponse })
    api.collect.mockResolvedValue({
      data: {
        lockAcquired: true,
        collectedAt: '2026-08-27T12:00:00.000Z',
        sources: [],
        failedSources: [],
      },
    })
    api.getSubscription.mockResolvedValue({
      data: { enabled: true, deliveryTime: '09:00', recipients: ['sales@dfkorea.co.kr'] },
    })
    api.updateSubscription.mockResolvedValue({
      data: { enabled: true, deliveryTime: '09:00', recipients: ['sales@dfkorea.co.kr'] },
    })
    api.getMailOAuthStatus.mockResolvedValue({
      data: {
        connected: false,
        connectedAt: null,
        accessTokenExpiresAt: null,
      },
    })
    api.authorizeMailOAuth.mockResolvedValue({
      data: { authorizationUrl: 'https://auth.worksmobile.com/oauth2/v2.0/authorize?state=safe' },
    })
  })

  afterEach(() => {
    cleanupMountedWrappers()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('applies and resets calendar filters', async () => {
    const wrapper = mountTenderManagement()
    await flushPromises()

    await wrapper.get('[data-test="open-filter"]').trigger('click')
    await wrapper.get('[data-test="filter-keyword"]').setValue('서울')
    await wrapper.get('[data-test="apply-filter"]').trigger('click')
    await flushPromises()

    expect(api.getCalendar).toHaveBeenLastCalledWith('2026-08', expect.objectContaining({ keyword: '서울' }))
    expect(api.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ registeredDate: '2026-08-27', keyword: '서울', page: 1 }),
    )
    await wrapper.get('[data-test="reset-filter"]').trigger('click')
    await flushPromises()
    expect(api.getCalendar).toHaveBeenLastCalledWith('2026-08', expect.objectContaining({ keyword: undefined }))
    expect(api.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ registeredDate: '2026-08-27', keyword: undefined, page: 1 }),
    )
  })

  it('prevents a second immediate collection while the first request is loading and reports a held lock without refreshing', async () => {
    const collection = deferred<{ data: { lockAcquired: boolean; collectedAt: string; sources: []; failedSources: [] } }>()
    api.collect.mockImplementationOnce(() => collection.promise)
    const wrapper = mountTenderManagement()
    await flushPromises()

    const collectButton = wrapper.get<HTMLButtonElement>('[data-test="collect-tenders"]')
    expect(collectButton.attributes('aria-label')).toBe('공고 즉시 수집')
    expect(collectButton.attributes('aria-busy')).toBe('false')

    await collectButton.trigger('click')
    await collectButton.trigger('click')

    expect(api.collect).toHaveBeenCalledTimes(1)
    expect(collectButton.element.disabled).toBe(true)
    expect(collectButton.attributes('aria-label')).toBe('공고 즉시 수집')
    expect(collectButton.attributes('aria-busy')).toBe('true')

    collection.resolve({
      data: {
        lockAcquired: false,
        collectedAt: '2026-08-27T12:00:00.000Z',
        sources: [],
        failedSources: [],
      },
    })
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('이미 수집이 진행 중입니다.')
    expect(api.getCalendar).toHaveBeenCalledTimes(1)
    expect(api.getAll).toHaveBeenCalledTimes(1)
  })

  it('preserves a page change made during collection for the post-collection refresh', async () => {
    const collection = deferred<{ data: { lockAcquired: boolean; collectedAt: string; sources: []; failedSources: [] } }>()
    const pageChange = deferred<{ data: typeof listResponse }>()
    const refresh = deferred<{ data: typeof listResponse }>()
    api.getAll
      .mockResolvedValueOnce({ data: { ...listResponse, totalPages: 2 } })
      .mockImplementationOnce(() => pageChange.promise)
      .mockImplementationOnce(() => refresh.promise)
    api.collect.mockImplementationOnce(() => collection.promise)
    const wrapper = mountTenderManagement()
    await flushPromises()

    await wrapper.get('[data-test="collect-tenders"]').trigger('click')
    await wrapper.get('[aria-label="다음 페이지"]').trigger('click')
    expect(api.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    collection.resolve({
      data: {
        lockAcquired: true,
        collectedAt: '2026-08-27T12:00:00.000Z',
        sources: [],
        failedSources: [],
      },
    })
    await flushPromises()

    expect(api.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    refresh.resolve({ data: { ...listResponse, page: 2, totalPages: 2 } })
    pageChange.resolve({ data: { ...listResponse, page: 2, totalPages: 2 } })
    await flushPromises()
  })

  it('refreshes the current filtered calendar and list page after a partial collection', async () => {
    api.getAll.mockResolvedValue({ data: { ...listResponse, totalPages: 2 } })
    api.collect.mockResolvedValueOnce({
      data: {
        lockAcquired: true,
        collectedAt: '2026-08-27T12:00:00.000Z',
        sources: [],
        failedSources: ['KAPT'],
      },
    })
    const wrapper = mountTenderManagement()
    await flushPromises()

    await wrapper.get('[data-test="open-filter"]').trigger('click')
    await wrapper.get('[data-test="filter-keyword"]').setValue('서울')
    await wrapper.get('[data-test="apply-filter"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="collect-tenders"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('일부 출처 수집에 실패했습니다.')
    expect(api.getCalendar).toHaveBeenLastCalledWith('2026-08', expect.objectContaining({ keyword: '서울' }))
    expect(api.getAll).toHaveBeenLastCalledWith(expect.objectContaining({
      registeredDate: '2026-08-27',
      keyword: '서울',
      page: 1,
      pageSize: 20,
    }))
  })

  it('keeps existing calendar and list data visible when immediate collection fails', async () => {
    api.collect.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountTenderManagement()
    await flushPromises()

    await wrapper.get('[data-test="collect-tenders"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('공고 수집을 시작하지 못했습니다.')
    expect(wrapper.text()).toContain('서울 LED 조명 교체')
    expect(api.getCalendar).toHaveBeenCalledTimes(1)
    expect(api.getAll).toHaveBeenCalledTimes(1)
  })

  it('never copies calendar filters into the recipient settings payload', async () => {
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-filter"]').trigger('click')
    await wrapper.get('[data-test="filter-keyword"]').setValue('서울')
    await wrapper.get('[data-test="apply-filter"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    const saveButton = document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')
    if (!saveButton) throw new Error('Expected subscription save button')
    await saveButton.click()
    await flushPromises()

    expect(api.updateSubscription).toHaveBeenCalledWith({
      enabled: true,
      deliveryTime: '09:00',
      recipients: ['sales@dfkorea.co.kr'],
    })
  })

  it('loads NAVER WORKS connection status when opening reception settings', async () => {
    api.getMailOAuthStatus.mockResolvedValueOnce({
      data: {
        connected: true,
        connectedAt: '2026-08-31T00:00:00.000Z',
        accessTokenExpiresAt: '2026-08-31T01:00:00.000Z',
      },
    })
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    await flushPromises()

    expect(api.getMailOAuthStatus).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector('[data-test="mail-oauth-status"]')?.textContent).toContain('연결됨')
    expect(document.body.querySelector('[data-test="authorize-mail-oauth"]')?.textContent).toContain('다시 연결')
  })

  it('shows a safe error instead of navigating to an untrusted authorization URL', async () => {
    api.authorizeMailOAuth.mockResolvedValueOnce({
      data: { authorizationUrl: 'https://evil.example/oauth/authorize' },
    })
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    await flushPromises()
    const button = document.body.querySelector<HTMLButtonElement>('[data-test="authorize-mail-oauth"]')
    if (!button) throw new Error('Expected NAVER WORKS authorization button')
    button.click()
    await flushPromises()

    expect(document.body.querySelector('[data-test="mail-oauth-error"]')?.textContent).toContain('연결을 시작하지 못했습니다')
    expect(window.location.hostname).not.toBe('evil.example')
  })

  it('navigates to the trusted NAVER WORKS authorization URL returned by the backend', async () => {
    const authorizationUrl = 'https://auth.worksmobile.com/oauth2/v2.0/authorize?state=safe'
    api.authorizeMailOAuth.mockResolvedValueOnce({ data: { authorizationUrl } })
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    await flushPromises()
    const button = document.body.querySelector<HTMLButtonElement>('[data-test="authorize-mail-oauth"]')
    if (!button) throw new Error('Expected NAVER WORKS authorization button')
    button.click()
    await flushPromises()

    expect(window.location.href).toBe(authorizationUrl)
  })

  it('refreshes OAuth status and reports success after the callback query', async () => {
    window.history.replaceState({}, '', '/admin?tab=tenders&mailOAuth=connected')
    api.getMailOAuthStatus.mockResolvedValueOnce({
      data: {
        connected: true,
        connectedAt: '2026-08-31T00:00:00.000Z',
        accessTokenExpiresAt: '2026-08-31T01:00:00.000Z',
      },
    })

    const wrapper = mountTenderManagement()
    await flushPromises()

    expect(api.getMailOAuthStatus).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-test="mail-oauth-feedback"]').text()).toContain('NAVER WORKS 메일 연결이 완료되었습니다')
    expect(new URL(window.location.href).searchParams.has('mailOAuth')).toBe(false)
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('tenders')
  })

  it('refetches settings on every modal open and disables save after a failed refresh without overwriting loaded settings', async () => {
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    await flushPromises()
    expect(api.getSubscription).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')?.disabled).toBe(false)

    closeSubscriptionModal()
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    api.getSubscription.mockRejectedValueOnce(new Error('transient failure'))

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()

    expect(api.getSubscription).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('수신 설정을 불러오지 못했습니다')
    expect(document.body.textContent).toContain('sales@dfkorea.co.kr')
    const save = document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')
    expect(save?.disabled).toBe(true)
    save?.click()
    await flushPromises()
    expect(api.updateSubscription).not.toHaveBeenCalled()
  })

  it('keeps the latest failed load authoritative when an older success resolves afterward', async () => {
    const first = deferred<{ data: { enabled: boolean; deliveryTime: string; recipients: string[] } }>()
    const second = deferred<{ data: { enabled: boolean; deliveryTime: string; recipients: string[] } }>()
    api.getSubscription
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    closeSubscriptionModal()
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    second.reject(new Error('current request failed'))
    await flushPromises()
    first.resolve({
      data: { enabled: true, deliveryTime: '08:00', recipients: ['stale@dfkorea.co.kr'] },
    })
    await flushPromises()

    expect(document.body.textContent).toContain('수신 설정을 불러오지 못했습니다')
    expect(document.body.textContent).not.toContain('stale@dfkorea.co.kr')
    expect(document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')?.disabled).toBe(true)
  })

  it('keeps the latest successful load when an older failure rejects afterward', async () => {
    const first = deferred<{ data: { enabled: boolean; deliveryTime: string; recipients: string[] } }>()
    const second = deferred<{ data: { enabled: boolean; deliveryTime: string; recipients: string[] } }>()
    api.getSubscription
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    closeSubscriptionModal()
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    second.resolve({
      data: { enabled: true, deliveryTime: '10:30', recipients: ['latest@dfkorea.co.kr'] },
    })
    await flushPromises()
    first.reject(new Error('stale request failed'))
    await flushPromises()

    expect(document.body.textContent).toContain('latest@dfkorea.co.kr')
    expect(document.body.textContent).not.toContain('수신 설정을 불러오지 못했습니다')
    expect(document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')?.disabled).toBe(false)
  })

  it('retries the current failed load from the modal and enables save only after that retry succeeds', async () => {
    api.getSubscription
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce({
        data: { enabled: true, deliveryTime: '11:45', recipients: ['retry@dfkorea.co.kr'] },
      })
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')?.disabled).toBe(true)

    const retry = document.body.querySelector<HTMLButtonElement>('[data-test="retry-subscription"]')
    if (!retry) throw new Error('Expected subscription retry button')
    retry.click()
    await flushPromises()

    expect(api.getSubscription).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('retry@dfkorea.co.kr')
    expect(document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')?.disabled).toBe(false)
  })

  it('invalidates an in-flight load as soon as the modal closes', async () => {
    const first = deferred<{ data: { enabled: boolean; deliveryTime: string; recipients: string[] } }>()
    const second = deferred<{ data: { enabled: boolean; deliveryTime: string; recipients: string[] } }>()
    api.getSubscription
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    closeSubscriptionModal()
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    first.resolve({
      data: { enabled: true, deliveryTime: '08:00', recipients: ['closed-stale@dfkorea.co.kr'] },
    })
    await flushPromises()
    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    expect(document.body.textContent).not.toContain('closed-stale@dfkorea.co.kr')
    expect(document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')?.disabled).toBe(true)

    second.resolve({
      data: { enabled: true, deliveryTime: '12:15', recipients: ['current@dfkorea.co.kr'] },
    })
    await flushPromises()
    expect(document.body.textContent).toContain('current@dfkorea.co.kr')
    expect(document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')?.disabled).toBe(false)
  })

  it('renders loading, error, and empty list states instead of stale notices', async () => {
    api.getAll.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountTenderManagement()
    await flushPromises()
    expect(wrapper.get('[data-test="tender-list-error"]').text()).toContain('불러오지 못했습니다')

    api.getAll.mockResolvedValueOnce({ data: { ...listResponse, data: [], total: 0 } })
    await wrapper.get('[data-date="2026-08-27"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="tender-list-empty"]').text()).toContain('공고가 없습니다')
  })

  it('unmounts tracked wrappers and releases modal global state during cleanup', async () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountTenderManagement(true)
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    await flushPromises()
    expect(document.body.style.overflow).toBe('hidden')

    cleanupMountedWrappers()

    expect(wrapper.exists()).toBe(false)
    expect(document.body.style.overflow).toBe('')
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
