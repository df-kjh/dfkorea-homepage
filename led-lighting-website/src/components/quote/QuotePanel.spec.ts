import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QuotePanel from './QuotePanel.vue'
import { useQuoteDraft } from '@/composables/useQuoteDraft'
vi.mock('@/composables/useQuoteDraft', async () => {
  const { reactive } = await import('vue')
  const draft = reactive({
    open: false,
    step: 2,
    busy: false,
    reference: '',
    pendingSubmission: null,
    error: '',
  })
  return {
    useQuoteDraft: () => ({
      draft,
      close: () => {
        draft.open = false
      },
      next: vi.fn(),
      submit: vi.fn(),
    }),
  }
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})
describe('responsive quote panel', () => {
  it('acts as a mobile dialog, releases background inert state on ESC, and retains the step', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const host = document.createElement('div')
    host.id = 'quote-widget'
    const background = document.createElement('main')
    document.body.append(background, host)
    const wrapper = mount(QuotePanel, {
      attachTo: host,
      global: {
        stubs: { CompanyStep: true, ProductStep: true, ReviewStep: true, SuccessState: true },
      },
    })
    const { draft } = useQuoteDraft()
    draft.open = true
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(wrapper.find('.q-size-toggle').exists()).toBe(false)
    expect(document.body.style.overflow).toBe('hidden')
    expect(background.inert).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(draft.open).toBe(false)
    expect(draft.step).toBe(2)
    expect(document.body.style.overflow).toBe('')
    expect(background.inert).toBe(false)
    wrapper.unmount()
  })
  it('keeps the desktop dialog nonmodal so the underlying page stays usable', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const host = document.createElement('div')
    host.id = 'quote-widget'
    document.body.append(host)
    const wrapper = mount(QuotePanel, {
      attachTo: host,
      global: {
        stubs: { CompanyStep: true, ProductStep: true, ReviewStep: true, SuccessState: true },
      },
    })
    useQuoteDraft().draft.open = true
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').attributes('aria-modal')).toBeUndefined()
    expect(document.body.style.overflow).toBe('')
    expect(wrapper.get('[role="dialog"]').classes()).toContain('q-panel--expanded')
    expect(wrapper.get('.q-size-toggle').attributes('aria-pressed')).toBe('true')
    await wrapper.get('.q-size-toggle').trigger('click')
    expect(wrapper.get('[role="dialog"]').classes()).not.toContain('q-panel--expanded')
    await wrapper.get('.q-close').trigger('click')
    useQuoteDraft().draft.open = true
    await flushPromises()
    expect(wrapper.get('.q-size-toggle').attributes('aria-pressed')).toBe('false')
    expect(useQuoteDraft().draft.step).toBe(2)
    await wrapper.get('.q-size-toggle').trigger('click')
    expect(wrapper.get('[role="dialog"]').classes()).toContain('q-panel--expanded')
    wrapper.unmount()
  })
})
