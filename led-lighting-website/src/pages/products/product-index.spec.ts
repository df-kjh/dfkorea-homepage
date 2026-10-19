import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref, Suspense } from 'vue'
import ProductIndex from './index.vue'

afterEach(() => vi.unstubAllGlobals())

it('requests the grouped first page for public server rendering', async () => {
  const requests: unknown[] = []
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBaseUrl: 'http://localhost:3000', siteUrl: 'https://dfkorealed.com' },
  }))
  vi.stubGlobal('useFetch', async (url: string, options: unknown) => {
    requests.push({ url, options })
    return { data: ref({ data: [], total: 23, page: 1, limit: 20, totalPages: 2 }) }
  })
  vi.stubGlobal('useHead', () => {})
  vi.stubGlobal('useSeoMeta', () => {})
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(ProductIndex) }) }),
    {
      global: { stubs: { ProductsView: true } },
    },
  )
  await flushPromises()
  expect(requests).toEqual([
    {
      url: 'http://localhost:3000/products',
      options: { key: 'products-initial-page', query: { page: 1, limit: 20, groupVariants: true } },
    },
  ])
  wrapper.unmount()
})
