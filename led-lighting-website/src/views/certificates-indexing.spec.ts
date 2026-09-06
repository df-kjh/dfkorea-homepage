import { flushPromises, mount } from '@vue/test-utils'
import { computed, createSSRApp, defineComponent, onMounted, ref } from 'vue'
import { createMemoryHistory, createRouter, useRoute } from 'vue-router'
import { renderToString } from 'vue/server-renderer'
import { useHead, useSeoMeta } from '@unhead/vue'
import { createHead, renderDOMHead } from '@unhead/vue/client'
import { createHead as createServerHead, renderSSRHead } from '@unhead/vue/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CertificatesView from './CertificatesView.vue'
import CertificateDetailView from './CertificateDetailView.vue'
import CertificatePage from '@/pages/certificates/[id].vue'

const api = vi.hoisted(() => ({ getAll: vi.fn() }))
vi.mock('@/api', () => ({ certificatesAPI: api }))
// The PDF library evaluates browser-only rendering code; selection and metadata
// are tested with the real detail screen and select control around this boundary.
vi.mock('vue-pdf-embed', () => ({ default: { template: '<div />' } }))

const certificates = [undefined, null, '', '   ', ' 고효율 ', '고효율', '효율 100%'].map(
  (category, index) => ({
    id: `certificate-${index}`,
    name: `인증서 ${index}`,
    category,
    issuingOrganization: '인증 기관',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }),
)

const ClientOnly = defineComponent({
  setup(_, { slots }) {
    const mounted = ref(false)
    onMounted(() => {
      mounted.value = true
    })
    return () => (mounted.value ? slots.default?.() : null)
  },
})

async function routerFor(category: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/certificates/:id?', component: { template: '<div />' } }],
  })
  await router.push(`/certificates/${encodeURIComponent(category)}?utm_source=mail#selected`)
  await router.isReady()
  return router
}

beforeEach(() => {
  api.getAll.mockReset().mockResolvedValue({ data: certificates })
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('useRoute', useRoute)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { siteUrl: 'https://dfkorealed.com' } }))
  vi.stubGlobal('useHead', useHead)
  vi.stubGlobal('useSeoMeta', useSeoMeta)
  window.history.replaceState({}, '', '/certificates/test?utm_source=mail#selected')
  document.head.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('certificate sitemap destinations', () => {
  it('groups blank and padded categories into their advertised destinations', async () => {
    const router = await routerFor('')
    const wrapper = mount(CertificatesView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.findAll('h3').map((node) => node.text())).toEqual([
      '기타',
      '고효율',
      '효율 100%',
    ])
    await wrapper.findAll('h3')[1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/certificates/%EA%B3%A0%ED%9A%A8%EC%9C%A8')
    wrapper.unmount()
  })

  it.each([
    ['기타', '기타', 4],
    ['   ', '기타', 4],
    ['고효율', '고효율', 2],
    [' 고효율 ', '고효율', 2],
    ['효율 100%', '효율 100%', 1],
  ])('renders every record for decoded category %j', async (category, heading, count) => {
    const router = await routerFor(category)
    const wrapper = mount(CertificateDetailView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe(heading)
    expect(wrapper.get('nav').text()).toContain(`${count}개의 인증서`)
    await wrapper.get('.base-select').trigger('click')
    expect(wrapper.findAll('.base-select__option')).toHaveLength(count)
    wrapper.unmount()
  })
})

describe('certificate page metadata ownership', () => {
  it.each([
    [' 고효율 ', 'https://dfkorealed.com/certificates/%EA%B3%A0%ED%9A%A8%EC%9C%A8'],
    ['   ', 'https://dfkorealed.com/certificates/%EA%B8%B0%ED%83%80'],
  ])('server-renders the normalized canonical for %j', async (category, canonical) => {
    const head = createServerHead()
    const app = createSSRApp(CertificatePage)
      .use(head)
      .use(await routerFor(category))
    app.component('ClientOnly', ClientOnly)
    await renderToString(app)
    const { headTags } = await renderSSRHead(head)
    expect(headTags).toContain(`<link rel="canonical" href="${canonical}">`)
    expect(headTags).not.toContain('utm_source')
  })

  it('keeps server URLs through hydration, API completion, and certificate selection', async () => {
    const canonical = 'https://dfkorealed.com/certificates/%EA%B3%A0%ED%9A%A8%EC%9C%A8'
    const router = await routerFor('고효율')
    const serverHead = createServerHead()
    const serverApp = createSSRApp(CertificatePage).use(serverHead).use(router)
    serverApp.component('ClientOnly', ClientOnly)
    const html = await renderToString(serverApp)
    document.head.innerHTML = (await renderSSRHead(serverHead)).headTags
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const assertUrls = () => {
      expect(
        [...document.querySelectorAll('link[rel="canonical"]')].map((node) =>
          node.getAttribute('href'),
        ),
      ).toEqual([canonical])
      expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
        canonical,
      )
      expect(document.querySelector('meta[name="twitter:url"]')?.getAttribute('content')).toBe(
        canonical,
      )
    }
    assertUrls()
    let resolve!: (value: { data: typeof certificates }) => void
    api.getAll.mockImplementation(
      () =>
        new Promise((yes) => {
          resolve = yes
        }),
    )
    const head = createHead()
    const app = createSSRApp(CertificatePage).use(head).use(router)
    app.component('ClientOnly', ClientOnly)
    app.mount(container)
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    await renderDOMHead(head)
    assertUrls()
    resolve({ data: certificates })
    await flushPromises()
    await renderDOMHead(head)
    assertUrls()
    expect(document.title).toContain('인증서 4')
    container.querySelector<HTMLElement>('.base-select')!.click()
    await flushPromises()
    container.querySelectorAll<HTMLElement>('.base-select__option')[1]!.click()
    await flushPromises()
    await renderDOMHead(head)
    assertUrls()
    expect(document.title).toContain('인증서 5')
    app.unmount()
  })
})
