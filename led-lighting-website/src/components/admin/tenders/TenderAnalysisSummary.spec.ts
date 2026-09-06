import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import Summary from './TenderAnalysisSummary.vue'
import { analysis } from './__fixtures__/analysis'
describe('TenderAnalysisSummary', () => {
  it('shows percentage with specification coverage, keeping global unknowns separate', () => {
    const wrapper = mount(Summary, { props: { analysis } })
    expect(wrapper.text()).toContain('82%')
    expect(wrapper.text()).toContain('9개 중 7개 충족, 1개 불일치, 1개 확인 필요')
    expect(wrapper.text()).toContain('분석 범위 8/9')
    expect(wrapper.text()).toContain('전체 확인 필요 4개')
  })
  it('does not manufacture a denominator when server projection omitted specifications', () => {
    const wrapper = mount(Summary, { props: { analysis: { ...analysis, requirements: [] } } })
    expect(wrapper.text()).toContain('전체 사양 수 확인 필요')
    expect(wrapper.text()).not.toContain('0개 중 7개')
  })
  it('counts omitted certification evaluations as unknown instead of zero unknowns', () => {
    const wrapper = mount(Summary, {
      props: {
        analysis: {
          ...analysis,
          certificationAnalysis: { requirements: [{ id: 'missing', name: 'KC' }], evaluations: [] },
        },
      },
    })
    expect(wrapper.text()).toContain('0개 미충족 · 1개 확인 필요')
  })
  it('does not invent a percentage without comparable specifications', () => {
    const wrapper = mount(Summary, {
      props: { analysis: { ...analysis, specificationScore: null, comparableCount: 0 } },
    })
    expect(wrapper.text()).toContain('계산 불가')
    expect(wrapper.text()).not.toContain('%')
  })
})
