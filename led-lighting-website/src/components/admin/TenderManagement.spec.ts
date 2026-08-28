import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getCalendar: vi.fn(),
  getAll: vi.fn(),
  getOne: vi.fn(),
  getSubscription: vi.fn(),
  updateSubscription: vi.fn(),
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
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-27T12:00:00.000Z'))
    vi.clearAllMocks()
    api.getCalendar.mockResolvedValue({ data: [{ date: '2026-08-27', total: 1, direct: 1, potential: 0 }] })
    api.getAll.mockResolvedValue({ data: listResponse })
    api.getSubscription.mockResolvedValue({
      data: { enabled: true, deliveryTime: '09:00', recipients: ['sales@dfkorea.co.kr'] },
    })
    api.updateSubscription.mockResolvedValue({
      data: { enabled: true, deliveryTime: '09:00', recipients: ['sales@dfkorea.co.kr'] },
    })
  })

  afterEach(() => {
    cleanupMountedWrappers()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('applies and resets calendar filters without showing a collection status control', async () => {
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
    expect(wrapper.text()).not.toContain('수집 현황')

    await wrapper.get('[data-test="reset-filter"]').trigger('click')
    await flushPromises()
    expect(api.getCalendar).toHaveBeenLastCalledWith('2026-08', expect.objectContaining({ keyword: undefined }))
    expect(api.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ registeredDate: '2026-08-27', keyword: undefined, page: 1 }),
    )
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
