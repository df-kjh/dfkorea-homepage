import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProductsView from './ProductsView.vue'
const api = vi.hoisted(() => ({ getPaginated: vi.fn(), getFilterOptions: vi.fn() }))
const infinite = vi.hoisted(() => ({ load: () => {} }))
vi.mock('@/api', () => ({ productsAPI: api }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/composables/useSEO', () => ({ useSEO: () => {} }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: () => {} }) }))
vi.mock('@/composables/useInfiniteScroll', async () => {
  const { ref } = await import('vue')
  return {
    useInfiniteScroll: ({ onLoadMore }: { onLoadMore: () => void }) => {
      infinite.load = onLoadMore
      return { observerTarget: ref(null) }
    },
  }
})
const page = (id: string, number = 1) => ({
  data: {
    data: [{ id, name: `제품 ${id}`, images: [], power: [40], colorTemp: [], certifications: [] }],
    total: 3,
    page: number,
  },
})
afterEach(() => vi.restoreAllMocks())
describe('main catalog append continuity', () => {
  it.each(['success', 'failure'] as const)(
    'keeps the current grid and viewport through append %s and retry',
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
      api.getFilterOptions.mockResolvedValue({
        data: { categories: [], power: [], colorTemp: [], options: [], certifications: [] },
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const scroll = vi.spyOn(window, 'scrollTo')
      const wrapper = mount(ProductsView, {
        global: {
          stubs: {
            ProductCard: { props: ['product'], template: '<article>{{ product.name }}</article>' },
          },
        },
      })
      await flushPromises()
      const first = wrapper.get('article').element
      infinite.load()
      await flushPromises()
      expect(wrapper.get('article').element).toBe(first)
      if (outcome === 'success') resolve(page('second', 2))
      else reject(new Error('offline'))
      await flushPromises()
      expect(wrapper.get('article').element).toBe(first)
      if (outcome === 'failure') {
        api.getPaginated.mockResolvedValueOnce(page('second', 2))
        await wrapper
          .findAll('button')
          .find((node) => node.text() === '다시 시도')!
          .trigger('click')
        await flushPromises()
      }
      expect(wrapper.get('article').element).toBe(first)
      expect(wrapper.findAll('article')).toHaveLength(2)
      expect(scroll).not.toHaveBeenCalled()
      wrapper.unmount()
    },
  )
})
