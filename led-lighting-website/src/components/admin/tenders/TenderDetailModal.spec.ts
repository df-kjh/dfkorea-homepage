import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import TenderDetailModal from './TenderDetailModal.vue'

describe('TenderDetailModal', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('uses the same KST timestamp format as the list', () => {
    mount(TenderDetailModal, {
      props: {
        modelValue: true,
        tender: {
          id: 'tender-1', source: 'G2B', sourceNoticeId: 'N-1', revision: '000', title: 'LED 조명', orderingOrganization: '서울시', demandOrganization: null,
          registeredAt: '2026-08-31T15:30:00.000Z', bidStartedAt: null, bidEndedAt: '2026-09-01T15:30:00.000Z', openedAt: null, region: '서울', procurementType: 'GOODS',
          contractMethod: null, estimatedAmount: null, sourceUrl: 'https://example.go.kr/1', relevance: 'DIRECT', relevanceScore: 100,
          relevanceReasons: [{ field: 'title', keyword: 'LED', score: 100 }],
          opportunityType: 'MAS', opportunityReasons: ['MAS 표현: 제목'],
        },
      },
      attachTo: document.body,
    })

    expect(document.body.textContent).toContain('2026. 9. 1. 00:30')
    expect(document.body.textContent).toContain('2026. 9. 2. 00:30')
  })

  it('shows the MAS badge and opportunity reasons from the public tender DTO', () => {
    mount(TenderDetailModal, {
      props: {
        modelValue: true,
        tender: {
          id: 'tender-2', source: 'KAPT', sourceNoticeId: 'K-1', revision: '000', title: 'MAS LED 조명', orderingOrganization: '서울시', demandOrganization: null,
          registeredAt: '2026-08-31T15:30:00.000Z', bidStartedAt: null, bidEndedAt: null, openedAt: null, region: '서울', procurementType: 'GOODS',
          contractMethod: 'MAS', estimatedAmount: null, sourceUrl: 'https://example.go.kr/2', relevance: 'DIRECT', relevanceScore: 100,
          relevanceReasons: [{ field: 'title', keyword: 'LED', score: 100 }], opportunityType: 'MAS', opportunityReasons: ['MAS 표현: 제목'],
        },
      },
      attachTo: document.body,
    })

    expect(document.body.querySelector('.tender-opportunity-badge')?.getAttribute('aria-label')).toBe('🧾 MAS')
    expect(document.body.textContent).toContain('기회 판정 근거')
    expect(document.body.textContent).toContain('MAS 표현: 제목')
    expect(document.body.textContent).not.toContain('rawData')
  })
})
