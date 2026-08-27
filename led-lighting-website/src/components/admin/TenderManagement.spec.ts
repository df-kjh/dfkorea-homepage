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

describe('TenderManagement', () => {
  beforeEach(() => {
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
    document.body.innerHTML = ''
  })

  it('applies and resets calendar filters without showing a collection status control', async () => {
    const wrapper = mount(TenderManagement)
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
    const wrapper = mount(TenderManagement, { attachTo: document.body })
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
    const wrapper = mount(TenderManagement, { attachTo: document.body })
    await flushPromises()

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    await flushPromises()
    expect(api.getSubscription).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')?.disabled).toBe(false)

    document.body
      .querySelector<HTMLButtonElement>('[aria-label="닫기"]')
      ?.click()
    await flushPromises()
    api.getSubscription.mockRejectedValueOnce(new Error('transient failure'))

    await wrapper.get('[data-test="open-subscription"]').trigger('click')
    await flushPromises()

    expect(api.getSubscription).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('수신 설정을 불러오지 못했습니다')
    expect(document.body.textContent).toContain('sales@dfkorea.co.kr')
    const save = document.body.querySelector<HTMLButtonElement>('[data-test="save-subscription"]')
    expect(save?.disabled).toBe(true)
    save?.click()
    await flushPromises()
    expect(api.updateSubscription).not.toHaveBeenCalled()
  })

  it('renders loading, error, and empty list states instead of stale notices', async () => {
    api.getAll.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mount(TenderManagement)
    await flushPromises()
    expect(wrapper.get('[data-test="tender-list-error"]').text()).toContain('불러오지 못했습니다')

    api.getAll.mockResolvedValueOnce({ data: { ...listResponse, data: [], total: 0 } })
    await wrapper.get('[data-date="2026-08-27"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="tender-list-empty"]').text()).toContain('공고가 없습니다')
  })
})
