import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DetailControl from './DetailControl.vue'
describe('registered control option concepts', () => {
  it('changes options by keyboard while preserving one selected tab and its panel label', async () => {
    const wrapper = mount(DetailControl, {
      props: { title: '제어', options: ['개별디밍', '그룹디밍', '센서'] },
      attachTo: document.body,
    })
    expect(wrapper.get('[aria-selected="true"]').text()).toContain('그룹디밍')
    await wrapper.get('[aria-selected="true"]').trigger('keydown', { key: 'End' })
    const selected = wrapper.get('[aria-selected="true"]')
    expect(selected.text()).toContain('센서')
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(
      selected.attributes('id'),
    )
    expect(document.activeElement).toBe(selected.element)
    await selected.trigger('keydown', { key: 'Home' })
    expect(wrapper.get('[aria-selected="true"]').text()).toContain('개별디밍')
    wrapper.unmount()
  })
})
