import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import QuoteLauncher from './QuoteLauncher.vue'
vi.mock('@/composables/useQuoteDraft', () => ({
  useQuoteDraft: () => ({
    draft: { open: false, items: [], reference: '' },
    open: vi.fn(),
    close: vi.fn(),
  }),
}))
describe('quote floating actions', () => {
  it('uses the parent Back to top visibility to position both panel and launcher, keeping an accessible icon label', async () => {
    const wrapper = mount(QuoteLauncher, {
      props: { backToTopVisible: false },
      global: { stubs: { teleport: true, QuotePanel: true } },
    })
    expect(wrapper.get('#quote-widget').classes()).not.toContain('q-widget--with-back-top')
    expect(wrapper.get('#quote-launcher').attributes('aria-label')).toBe('온라인 견적')
    expect(wrapper.get('.q-launcher-label').text()).toBe('온라인 견적')
    await wrapper.setProps({ backToTopVisible: true })
    expect(wrapper.get('#quote-widget').classes()).toContain('q-widget--with-back-top')
    await wrapper.setProps({ backToTopVisible: false })
    expect(wrapper.get('#quote-widget').classes()).not.toContain('q-widget--with-back-top')
    wrapper.unmount()
  })
})
