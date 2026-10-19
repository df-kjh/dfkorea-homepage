import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref, Suspense } from 'vue'
import ProductPage from './[id].vue'
import type { Product } from '@/types'
const addProduct = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useQuoteDraft', () => ({ useQuoteDraft: () => ({ addProduct }) }))
const product: Product = {
  id: 'detail-test',
  name: '실제 제품',
  category: '평판',
  modelName: 'DF-PANEL',
  dimensions: '600*600*30',
  images: [{ image: '/uploads/product.webp', description: '원본' }],
  power: [40],
  colorTemp: [5700],
  lifespan: 40000,
  ledChipManufacturer: '서울반도체',
  certifications: ['KS'],
  description: '## 기존 설명\n\n![기술 이미지](https://example.com/technical.webp)',
  createdAt: '',
  updatedAt: '',
}
const route = reactive({ params: { id: product.id }, query: {} as Record<string, string> })
const push = vi.fn(({ query }: { query: Record<string, string> }) => {
  route.query = query
})
const replace = vi.fn(({ query }: { query: Record<string, string> }) => {
  route.query = query
})
const back = vi.fn()
const seo = vi.fn(),
  head = vi.fn()
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.clearAllMocks()
  route.query = {}
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ push, replace, back }))
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBaseUrl: 'http://localhost:3000', siteUrl: 'https://dfkorealed.com' },
  }))
  vi.stubGlobal('useFetch', async () => ({ data: ref(product), error: ref(null) }))
  vi.stubGlobal('useSeoMeta', seo)
  vi.stubGlobal('useHead', head)
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
const render = async () => {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(ProductPage) }) }),
    { attachTo: document.body, global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } } },
  )
  await flushPromises()
  return wrapper
}
describe('actual product detail page integration', () => {
  it('keeps the quote entry connected to the actual product and native click event', async () => {
    const wrapper = await render()
    await wrapper.get('[data-quote]').trigger('click')
    expect(addProduct).toHaveBeenCalledWith(product, expect.any(MouseEvent))
  })
  it('keeps legacy image query indexes and close history, including API relative images', async () => {
    const wrapper = await render()
    expect(wrapper.get('[data-image] img').attributes('src')).toBe(
      'http://localhost:3000/uploads/product.webp',
    )
    await wrapper.get('[data-image]').trigger('click')
    expect(push).toHaveBeenCalledWith({ query: { image: '0' } })
    expect(document.querySelector('[role="dialog"] img')?.getAttribute('src')).toBe(
      'http://localhost:3000/uploads/product.webp',
    )
    ;(document.querySelector('[aria-label="이미지 상세보기 닫기"]') as HTMLButtonElement).click()
    expect(back).toHaveBeenCalledOnce()
  })
  it('retains a single canonical and product metadata using registered photo URLs', async () => {
    await render()
    expect(seo.mock.calls[0]?.[0].title()).toContain('실제 제품')
    const config = head.mock.calls.map(([value]) => value).find((value) => value.link)
    expect(config.link[0].href.value).toBe('https://dfkorealed.com/products/detail-test')
    const schema = JSON.parse(config.script[0].innerHTML.value)
    expect(schema['@type']).toBe('Product')
    expect(schema.image).toEqual(['http://localhost:3000/uploads/product.webp'])
  })
})
