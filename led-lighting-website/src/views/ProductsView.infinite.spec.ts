import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import ProductsView from './ProductsView.vue'
import ProductsHeader from '@/components/products/ProductsHeader.vue'
const api = vi.hoisted(() => ({ getPaginated: vi.fn(), getFilterOptions: vi.fn() }))
vi.mock('@/api', () => ({ productsAPI: api }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/composables/useSEO', () => ({ useSEO: () => {} }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: () => {} }) }))
const page = (id: string, number = 1) => ({
  data: {
    data: [{ id, name: id, images: [], power: [], colorTemp: [], certifications: [] }],
    total: 3,
    page: number,
  },
})
afterEach(() => vi.unstubAllGlobals())
it('loads a newly filtered sentinel while an obsolete append is still pending', async () => {
  const intersections: IntersectionObserverCallback[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersections.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  let stale!: (value: unknown) => void
  api.getPaginated
    .mockResolvedValueOnce(page('old'))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          stale = resolve
        }),
    )
    .mockResolvedValueOnce(page('filtered'))
    .mockResolvedValueOnce(page('filtered-next', 2))
  api.getFilterOptions.mockResolvedValue({
    data: { categories: [], power: [], colorTemp: [], options: [], certifications: [] },
  })
  const wrapper = mount(ProductsView, {
    global: {
      stubs: {
        ProductCard: { props: ['product'], template: '<article>{{ product.name }}</article>' },
      },
    },
  })
  await flushPromises()
  const enter = () =>
    intersections.at(-1)!(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
  enter()
  await flushPromises()
  wrapper.getComponent(ProductsHeader).vm.$emit('search', 'filtered')
  await flushPromises()
  enter()
  await flushPromises()
  expect(wrapper.findAll('article').map((node) => node.text())).toEqual([
    'filtered',
    'filtered-next',
  ])
  stale(page('stale', 2))
  await flushPromises()
  expect(wrapper.findAll('article').map((node) => node.text())).toEqual([
    'filtered',
    'filtered-next',
  ])
  wrapper.unmount()
})
