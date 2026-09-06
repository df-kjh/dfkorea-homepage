import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProductPicker from './ProductPicker.vue'
import ProductStep from './ProductStep.vue'
const api = vi.hoisted(() => ({ getPaginated: vi.fn(), getFilterOptions: vi.fn() }))
vi.mock('@/api', () => ({ productsAPI: api }))
vi.mock('@/composables/useQuoteDraft', () => ({
  useQuoteDraft: () => ({
    add: () => true,
    uid: () => 'id',
    draft: { items: [], busy: false, pendingSubmission: null },
  }),
}))
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})
describe('product picker search', () => {
  it('shows catalog fetch failure separately from zero matching products', async () => {
    api.getPaginated.mockRejectedValueOnce(new Error('offline'))
    api.getFilterOptions.mockResolvedValue({
      data: { categories: [], power: [], colorTemp: [], options: [], certifications: [] },
    })
    const wrapper = mount(ProductPicker)
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('불러오지 못했습니다')
    expect(wrapper.text()).not.toContain('조건에 맞는 제품이 없습니다')
    wrapper.unmount()
  })
  it('discards stale catalog responses after a new search condition', async () => {
    vi.useFakeTimers()
    let oldResponse!: (value: unknown) => void
    api.getPaginated
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            oldResponse = resolve
          }),
      )
      .mockResolvedValueOnce({ data: { data: [], total: 0, page: 1, limit: 8, totalPages: 0 } })
    const wrapper = mount(ProductPicker)
    await wrapper.find('input[type="search"]').setValue('new-model')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    oldResponse({
      data: {
        data: [{ id: 'stale', name: '오래된 제품', images: [], power: [], certifications: [] }],
        total: 1,
        page: 1,
      },
    })
    await flushPromises()
    expect(wrapper.text()).not.toContain('오래된 제품')
    expect(wrapper.text()).toContain('조건에 맞는 제품이 없습니다')
    wrapper.unmount()
  })
})

const product = (id: string) => ({
  id,
  name: `제품 ${id}`,
  images: [],
  power: [40],
  colorTemp: [5700],
  certifications: [],
})
const page = (id: string, number = 1) => ({ data: { data: [product(id)], total: 3, page: number } })
const button = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll('button').find((node) => node.text() === text)!

describe('catalog append and selection continuity', () => {
  it.each(['success', 'failure'] as const)(
    'retains existing result nodes and scroll throughout append %s and retry',
    async (outcome) => {
      let resolve!: (value: unknown) => void
      let reject!: (reason: Error) => void
      api.getPaginated
        .mockReset()
        .mockResolvedValueOnce(page('first'))
        .mockImplementationOnce(
          () =>
            new Promise((yes, no) => {
              resolve = yes
              reject = no
            }),
        )
      const host = document.createElement('div')
      host.className = 'q-body'
      document.body.append(host)
      const wrapper = mount(ProductPicker, { attachTo: host })
      await flushPromises()
      const first = wrapper.get('.q-product').element
      host.scrollTop = 413
      await button(wrapper, '제품 더 보기').trigger('click')
      expect(wrapper.get('.q-product').element).toBe(first)
      expect(host.scrollTop).toBe(413)
      expect(wrapper.find('.q-load-more button').attributes('disabled')).toBeDefined()
      // Keep the user's current position, including movement while the network is pending.
      host.scrollTop = 389
      if (outcome === 'success') resolve(page('second', 2))
      else reject(new Error('offline'))
      await flushPromises()
      expect(wrapper.get('.q-product').element).toBe(first)
      expect(host.scrollTop).toBe(389)
      if (outcome === 'failure') {
        api.getPaginated.mockResolvedValueOnce(page('second', 2))
        await button(wrapper, '다시 시도').trigger('click')
        await flushPromises()
        expect(wrapper.get('.q-product').element).toBe(first)
        expect(host.scrollTop).toBe(389)
      }
      expect(wrapper.findAll('.q-product')).toHaveLength(2)
      wrapper.unmount()
      host.remove()
    },
  )
  it('ignores an append response after filters change', async () => {
    vi.useFakeTimers()
    let oldResponse!: (value: unknown) => void
    api.getPaginated
      .mockReset()
      .mockResolvedValueOnce(page('first'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            oldResponse = resolve
          }),
      )
      .mockResolvedValueOnce(page('filtered'))
    const wrapper = mount(ProductPicker)
    await flushPromises()
    await button(wrapper, '제품 더 보기').trigger('click')
    await wrapper.get('input[type="search"]').setValue('filtered')
    await vi.advanceTimersByTimeAsync(300)
    oldResponse(page('stale', 2))
    await flushPromises()
    expect(wrapper.findAll('.q-product')).toHaveLength(1)
    expect(wrapper.get('.q-product').text()).toContain('제품 filtered')
    wrapper.unmount()
  })
  it('reveals and focuses the specification immediately, and restores the selection button on cancel', async () => {
    api.getPaginated.mockReset().mockResolvedValue(page('first'))
    const host = document.createElement('div')
    host.className = 'q-body'
    document.body.append(host)
    const wrapper = mount(ProductPicker, { attachTo: host })
    await flushPromises()
    const origin = wrapper.get('.q-product button')
    await origin.trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('.q-specification h4').element)
    expect(wrapper.get('.q-specification').text()).toContain('목록에 담기')
    await button(wrapper, '취소').trigger('click')
    expect(document.activeElement).toBe(origin.element)
    wrapper.unmount()
    host.remove()
  })
  it('treats pending catalog specifications as editing until cancelled or added', async () => {
    api.getPaginated.mockReset().mockResolvedValue(page('first'))
    const wrapper = mount(ProductStep, { global: { stubs: { QuotePhotos: true } } })
    await flushPromises()
    expect(wrapper.vm.isEditing()).toBe(false)
    await wrapper.get('.q-product button').trigger('click')
    expect(wrapper.vm.isEditing()).toBe(true)
    await button(wrapper, '취소').trigger('click')
    expect(wrapper.vm.isEditing()).toBe(false)
    await wrapper.get('.q-product button').trigger('click')
    await button(wrapper, '견적 목록에 담기').trigger('click')
    expect(wrapper.vm.isEditing()).toBe(false)
    expect(wrapper.find('[role="status"]').text()).toContain('담았습니다')
    wrapper.unmount()
  })
})
