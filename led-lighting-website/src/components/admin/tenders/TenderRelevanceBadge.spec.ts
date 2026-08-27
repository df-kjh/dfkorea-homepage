import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TenderRelevanceBadge from './TenderRelevanceBadge.vue'

describe('TenderRelevanceBadge', () => {
  it('distinguishes direct lighting notices with an icon and Korean accessible label', () => {
    const wrapper = mount(TenderRelevanceBadge, { props: { relevance: 'DIRECT' } })

    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('💡 직접 관련')
    expect(wrapper.text()).toContain('직접 관련')
    expect(wrapper.get('.material-symbols-outlined').text()).toBe('lightbulb')
  })

  it('distinguishes potential notices with an icon and Korean accessible label', () => {
    const wrapper = mount(TenderRelevanceBadge, { props: { relevance: 'POTENTIAL' } })

    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('⚡ 잠재 관련')
    expect(wrapper.text()).toContain('잠재 관련')
    expect(wrapper.get('.material-symbols-outlined').text()).toBe('bolt')
  })

  it.each([
    ['DIRECT', '💡 직접 관련'],
    ['POTENTIAL', '⚡ 잠재 관련'],
  ] as const)('keeps the full %s category name available in compact mode', (relevance, label) => {
    const wrapper = mount(TenderRelevanceBadge, { props: { relevance, compact: true } })

    expect(wrapper.attributes()).toMatchObject({ role: 'img', 'aria-label': label })
    expect(wrapper.text()).not.toContain(relevance === 'DIRECT' ? '직접 관련' : '잠재 관련')
  })
})
