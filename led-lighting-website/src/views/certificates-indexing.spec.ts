import { flushPromises, mount } from '@vue/test-utils'
import { computed, createSSRApp, defineComponent, onMounted, ref } from 'vue'
import { createMemoryHistory, createRouter, RouterLink, useRoute } from 'vue-router'
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
vi.mock('vue-pdf-embed', () => ({
  default: { props: ['source'], template: '<div data-pdf :data-source="source" />' },
}))

const certificates = [undefined, null, '', '   ', ' 고효율 ', '고효율', '효율 100%'].map(
  (category, index) => ({
    id: `certificate-${index}`,
    name: `인증서 ${index}`,
    category,
    issuingOrganization: '인증 기관',
    certificatePdf: `/certificates/document-${index}.pdf`,
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
    const wrapper = mount(CertificatesView, {
      global: { plugins: [router], stubs: { NuxtLink: RouterLink } },
    })
    await flushPromises()
    expect(wrapper.findAll('[data-certificate-category] h2').map((node) => node.text())).toEqual([
      '기타',
      '고효율',
      '효율 100%',
    ])
    const links = wrapper.findAll('a[data-certificate-category]')
    expect(links[2]!.attributes('href')).toBe('/certificates/%ED%9A%A8%EC%9C%A8%20100%25')
    await links[1]!.trigger('click')
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
    const wrapper = mount(CertificateDetailView, {
      global: { plugins: [router], stubs: { NuxtLink: RouterLink } },
    })
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe(heading)
    expect(wrapper.get('label[for="certificate-document"]').text()).toContain(`${count} DOCUMENTS`)
    expect(wrapper.findAll('select option')).toHaveLength(count)
    const selectedId = (wrapper.get('select').element as HTMLSelectElement).value
    const selected = certificates.find((certificate) => certificate.id === selectedId)!
    expect(wrapper.get('[data-pdf]').attributes('data-source')).toBe(selected.certificatePdf)
    expect(wrapper.get('a[download]').attributes('href')).toBe(selected.certificatePdf)
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
    app.component('NuxtLink', RouterLink)
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
    serverApp.component('NuxtLink', RouterLink)
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
    app.component('NuxtLink', RouterLink)
    app.mount(container)
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    await renderDOMHead(head)
    assertUrls()
    resolve({ data: certificates })
    await flushPromises()
    await renderDOMHead(head)
    assertUrls()
    expect(document.title).toContain('인증서 4')
    const select = container.querySelector<HTMLSelectElement>('#certificate-document')!
    select.value = 'certificate-5'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    await renderDOMHead(head)
    assertUrls()
    expect(document.title).toContain('인증서 5')
    expect(container.querySelector('[data-pdf]')?.getAttribute('data-source')).toBe(
      '/certificates/document-5.pdf',
    )
    expect(container.querySelector('a[download]')?.getAttribute('href')).toBe(
      '/certificates/document-5.pdf',
    )
    app.unmount()
  })
})
