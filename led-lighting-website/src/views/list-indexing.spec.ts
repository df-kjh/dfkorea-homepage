import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { createSSRApp, h, ref, type Component } from 'vue'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { renderToString } from 'vue/server-renderer'
import { useHead, useSeoMeta } from '@unhead/vue'
import { createHead } from '@unhead/vue/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaginatedResponse, Post, Product } from '@/types'
import ProductsPage from '@/pages/products/index.vue'
import BlogPage from '@/pages/blog/index.vue'
import ProductsView from './ProductsView.vue'
import BlogView from './BlogView.vue'
import HomeView from './HomeView.vue'
import CertificatesView from './CertificatesView.vue'

const api = vi.hoisted(() => ({
  products: { getPaginated: vi.fn(), getFilterOptions: vi.fn(), getFeatured: vi.fn() },
  posts: { getPaginated: vi.fn(), incrementView: vi.fn() },
  certificates: { getAll: vi.fn() },
}))
vi.mock('@/api', () => ({
  productsAPI: api.products,
  postsAPI: api.posts,
  certificatesAPI: api.certificates,
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: vi.fn() }) }))

const product: Product = {
  id: 'product-initial',
  name: '초기 제품',
  category: '주차장조명',
  images: [],
  modelName: 'DF-1',
  dimensions: '100 mm',
  power: [40],
  lifespan: 50000,
  colorTemp: [5700],
  ledChipManufacturer: 'DF Korea',
  certifications: [],
  description: '제품 설명',
  createdAt: '2026-09-01',
  updatedAt: '2026-09-01',
}
const post: Post = {
  id: 'post-initial',
  title: '초기 소식',
  excerpt: '최신 소식',
  content: '본문',
  category: '회사소식',
  image: '',
  views: 0,
  createdAt: '2026-09-01',
  updatedAt: '2026-09-01',
}
const productPage: PaginatedResponse<Product> = {
  data: [product],
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 2,
}
const postPage: PaginatedResponse<Post> = {
  data: [post],
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 2,
}

async function routerFor(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => h('div') } }],
  })
  await router.push(path)
  await router.isReady()
  return router
}

let intersections: IntersectionObserverCallback[]
beforeEach(() => {
  vi.clearAllMocks()
  api.products.getFilterOptions.mockResolvedValue({
    data: { categories: [], power: [], colorTemp: [], certifications: [], options: [] },
  })
  api.products.getPaginated.mockResolvedValue({ data: productPage })
  api.products.getFeatured.mockResolvedValue({ data: [] })
  api.posts.getPaginated.mockResolvedValue({ data: postPage })
  api.certificates.getAll.mockResolvedValue({ data: [] })
  intersections = []
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
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { siteUrl: 'https://dfkorealed.com', apiBaseUrl: 'https://api.example.test' },
  }))
  vi.stubGlobal('useHead', useHead)
  vi.stubGlobal('useSeoMeta', useSeoMeta)
  // Nuxt supplies useFetch and transfers its result in the hydration payload.
  // Only this HTTP/framework boundary is replaced; page -> view -> cards are real.
  vi.stubGlobal(
    'useFetch',
    async (url: string, options: { query: { page: number; limit: number } }) => {
      if (options.query.page !== 1 || options.query.limit !== 20)
        throw new Error('Expected the first 20 results')
      const data =
        url === 'https://api.example.test/products'
          ? productPage
          : url === 'https://api.example.test/posts'
            ? postPage
            : null
      return { data: ref(data), error: ref(null) }
    },
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
})

describe('initial list discovery', () => {
  it.each([
    ['/products', ProductsPage, '/products/product-initial', '초기 제품'],
    ['/blog', BlogPage, '/blog/post-initial', '초기 소식'],
  ] as const)(
    'renders %s detail anchors from page data before mounting',
    async (path, page, href, label) => {
      const app = createSSRApp(page)
        .use(await routerFor(path))
        .use(createHead())
      app.component('NuxtLink', RouterLink)
      const html = await renderToString(app)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const anchor = doc.querySelector(`a[href="${href}"]`)
      expect(anchor).not.toBeNull()
      expect(anchor?.textContent).toContain(label)
    },
  )

  it.each([
    [
      ProductsView,
      productPage,
      api.products,
      '/products/product-initial',
      '/products/product-next',
      { ...product, id: 'product-next' },
    ],
    [
      BlogView,
      postPage,
      api.posts,
      '/blog/post-initial',
      '/blog/post-next',
      { ...post, id: 'post-next' },
    ],
  ] as const)(
    'retains unchanged initial cards through the first-page refresh and page-two append',
    async (view, initialPage, listApi, firstHref, nextHref, nextItem) => {
      listApi.getPaginated.mockResolvedValueOnce({ data: initialPage }).mockResolvedValueOnce({
        data: { data: [nextItem], total: 2, page: 2, limit: 20, totalPages: 2 },
      })
      const wrapper = mount(view as Component, {
        props: { initialPage },
        global: { plugins: [await routerFor('/')], components: { NuxtLink: RouterLink } },
      })
      await flushPromises()
      expect(listApi.getPaginated.mock.calls[0]?.slice(0, 2)).toEqual([1, 20])
      const first = wrapper.get(`a[href="${firstHref}"]`).element
      intersections.at(-1)!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
      await flushPromises()
      expect(listApi.getPaginated.mock.calls[1]?.slice(0, 2)).toEqual([2, 20])
      expect(wrapper.get(`a[href="${firstHref}"]`).element).toBe(first)
      expect(wrapper.find(`a[href="${nextHref}"]`).exists()).toBe(true)
      wrapper.unmount()
    },
  )
})

describe('public view metadata ownership', () => {
  it.each([
    ['/', HomeView],
    ['/products', ProductsView],
    ['/blog', BlogView],
    ['/certificates', CertificatesView],
  ] as const)('preserves page-owned metadata while %s mounts and loads', async (path, view) => {
    const canonical = `https://dfkorealed.com${path === '/' ? '' : path}`
    document.head.innerHTML = `<title>Page-owned title</title><link rel="canonical" href="${canonical}"><meta property="og:url" content="${canonical}"><meta name="twitter:url" content="${canonical}">`
    window.history.replaceState({}, '', `${path}?utm_source=mail#section`)
    const wrapper = shallowMount(view as Component, {
      global: { plugins: [await routerFor(path)] },
    })
    await flushPromises()
    expect(document.title).toBe('Page-owned title')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical)
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      canonical,
    )
    expect(document.querySelector('meta[name="twitter:url"]')?.getAttribute('content')).toBe(
      canonical,
    )
    wrapper.unmount()
  })
})
