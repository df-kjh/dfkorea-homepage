import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Badge from './TenderSuitabilityBadge.vue'

describe('TenderSuitabilityBadge', () => {
  it.each([
    ['PENDING', null, '분석 대기'],
    ['PROCESSING', null, '분석 중'],
    ['COMPLETED', 'RECOMMENDED', '참여 추천'],
    ['COMPLETED', 'REVIEW', '검토 필요'],
    ['COMPLETED', 'DIFFICULT', '참여 어려움'],
    ['PARTIAL', 'RECOMMENDED', '부분 분석'],
    ['FAILED', 'RECOMMENDED', '분석 실패'],
    ['PARTIAL', 'DIFFICULT', '참여 어려움'],
  ] as const)(
    'renders %s / %s with Korean text and a non-color icon',
    (status, suitability, label) => {
      const wrapper = mount(Badge, { props: { status, suitability } })
      expect(wrapper.text()).toContain(label)
      expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(true)
    },
  )
})
