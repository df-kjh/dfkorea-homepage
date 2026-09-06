import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    company: {
      companyName: '',
      businessNumber: '',
      representativeName: '',
      openingDate: '',
      contactName: '',
      email: '',
      phone: '',
    },
    consent: false,
    verification: null as null | { verificationToken: string; expiresAt: string },
    items: [] as Array<{ clientId: string }>,
  })
  return {
    useQuoteDraft: () => ({
      draft,
      close: () => {
        draft.open = false
      },
      next: vi.fn(),
      submit: vi.fn(),
      isVerified: () =>
        !!draft.verification && Date.parse(draft.verification.expiresAt) > Date.now(),
    }),
  }
})
beforeEach(() => {
  const { draft } = useQuoteDraft()
  Object.assign(draft, {
    open: false,
    step: 2,
    busy: false,
    reference: '',
    pendingSubmission: null,
    error: '',
    consent: false,
    verification: null,
    items: [],
  })
  Object.assign(draft.company, {
    companyName: '',
    businessNumber: '',
    representativeName: '',
    openingDate: '',
    contactName: '',
    email: '',
    phone: '',
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})
describe('responsive quote panel', () => {
  it('enables product selection only after every required company field and verification are valid', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const wrapper = mount(QuotePanel, {
      global: {
        stubs: { CompanyStep: true, ProductStep: true, ReviewStep: true, SuccessState: true },
      },
    })
    const { draft } = useQuoteDraft()
    draft.step = 1
    await nextTick()
    const nextButton = () =>
      wrapper.findAll('button').find((node) => node.text().includes('제품 선택하기'))!
    expect(nextButton().attributes('disabled')).toBeDefined()
    Object.assign(draft.company, {
      companyName: '테스트 회사',
      businessNumber: '123-45-67890',
      representativeName: '대표자',
      openingDate: '2020-01-01',
      contactName: '담당자',
      email: 'customer@example.com',
    })
    draft.consent = true
    draft.verification = {
      verificationToken: 'verified',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }
    await nextTick()
    expect(nextButton().attributes('disabled')).toBeUndefined()
    draft.company.contactName = ''
    await nextTick()
    expect(nextButton().attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('enables request review only after at least one product is in the quote', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const wrapper = mount(QuotePanel, {
      global: {
        stubs: { CompanyStep: true, ProductStep: true, ReviewStep: true, SuccessState: true },
      },
    })
    const { draft } = useQuoteDraft()
    draft.step = 2
    draft.open = true
    await nextTick()
    const reviewButton = () =>
      wrapper.findAll('button').find((node) => node.text().includes('요청 확인하기'))!
    expect(reviewButton().attributes('disabled')).toBeDefined()
    draft.items.push({
      clientId: 'item-1',
      kind: 'custom',
      name: '테스트 조명',
      description: '테스트 사양',
      quantity: 1,
      certifications: [],
      options: [],
      attachmentIds: [],
    })
    await nextTick()
    expect(reviewButton().attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

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
