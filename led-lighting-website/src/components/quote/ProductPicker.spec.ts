import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProductPicker from './ProductPicker.vue'
const api = vi.hoisted(() => ({ getPaginated: vi.fn(), getFilterOptions: vi.fn() }))
vi.mock('@/api', () => ({ productsAPI: api }))
vi.mock('@/composables/useQuoteDraft', () => ({
  useQuoteDraft: () => ({ add: vi.fn(), uid: () => 'id' }),
}))
afterEach(() => vi.useRealTimers())
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
