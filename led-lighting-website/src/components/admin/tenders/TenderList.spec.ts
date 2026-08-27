import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TenderList from './TenderList.vue'

const tender = {
  id: 'tender-1', source: 'G2B' as const, sourceNoticeId: 'R26BK0001', revision: '000', title: '서울 LED 조명 교체', orderingOrganization: '서울시', demandOrganization: null,
  registeredAt: '2026-08-27T09:00:00.000Z', bidStartedAt: null, bidEndedAt: '2026-09-02T09:00:00.000Z', openedAt: null, region: '서울', procurementType: 'GOODS' as const,
  contractMethod: null, estimatedAmount: '5000000', sourceUrl: 'https://example.go.kr/tenders/1', relevance: 'DIRECT' as const, relevanceScore: 100, relevanceReasons: [{ field: 'title', keyword: 'LED', score: 100 }],
}

describe('TenderList', () => {
  it('shows a formatted deadline without urgency styling and opens details from an accessible action', async () => {
    const wrapper = mount(TenderList, {
      props: { response: { data: [tender], total: 1, page: 1, pageSize: 20, totalPages: 1 }, loading: false, error: null, selectedDate: '2026-08-27' },
    })
    const action = wrapper.get('[data-test="tender-details-tender-1"]')

    expect(wrapper.text()).toContain('입찰 마감')
    expect(wrapper.text()).toContain('2026. 9. 2.')
    expect(wrapper.html()).not.toContain('urgency')
    expect(action.element.tagName).toBe('BUTTON')
    action.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(wrapper.emitted('select')).toEqual([[tender]])
  })

  it('shows a dash when the deadline is unavailable', () => {
    const wrapper = mount(TenderList, {
      props: { response: { data: [{ ...tender, bidEndedAt: null }], total: 1, page: 1, pageSize: 20, totalPages: 1 }, loading: false, error: null, selectedDate: '2026-08-27' },
    })
    expect(wrapper.text()).toContain('입찰 마감')
    expect(wrapper.text()).toContain('-')
  })

  it('renders registration, deadline, and bigint amounts with the shared KST format', () => {
    const wrapper = mount(TenderList, {
      props: {
        response: {
          data: [{
            ...tender,
            registeredAt: '2026-08-31T15:30:00.000Z',
            bidEndedAt: '2026-09-01T15:30:00.000Z',
            estimatedAmount: '9007199254740993123456789',
          }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
        loading: false,
        error: null,
        selectedDate: '2026-09-01',
      },
    })

    expect(wrapper.text()).toContain('2026. 9. 1. 00:30')
    expect(wrapper.text()).toContain('2026. 9. 2. 00:30')
    expect(wrapper.text()).toContain('9,007,199,254,740,993,123,456,789원')
  })
})
