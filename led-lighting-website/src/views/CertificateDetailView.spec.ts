import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createMemoryHistory, RouterLink } from 'vue-router'
import CertificateDetailView from './CertificateDetailView.vue'

const getAll = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ certificatesAPI: { getAll } }))
vi.mock('vue-pdf-embed', () => ({
  default: {
    name: 'VuePdfEmbed',
    props: ['source'],
    emits: ['loading-failed', 'rendering-failed'],
    template: '<div data-pdf />',
  },
}))
beforeEach(() => getAll.mockReset())
async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/certificates', component: { template: '<div />' } },
      { path: '/certificates/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(`/certificates/${encodeURIComponent('KS % 인증')}`)
  const wrapper = mount(CertificateDetailView, {
    global: { plugins: [router], stubs: { NuxtLink: RouterLink } },
  })
  await flushPromises()
  return wrapper
}
const records = [
  { id: 'one', name: '첫 번째 문서', category: 'KS % 인증', certificatePdf: '/one.pdf' },
  { id: 'two', name: '두 번째 문서', category: 'KS % 인증', certificatePdf: '/two.pdf' },
]
describe('certificate document view', () => {
  it('retains original PDFs, keyboard selection and selected-document metadata', async () => {
    getAll.mockResolvedValue({ data: records })
    const wrapper = await setup()
    expect(wrapper.get('h1').text()).toBe('KS % 인증')
    expect(wrapper.get('a[download]').attributes('href')).toBe('/one.pdf')
    await wrapper.get('select').setValue('two')
    expect(wrapper.get('a[download]').attributes('href')).toBe('/two.pdf')
    expect(wrapper.emitted('select')?.at(-1)).toEqual([records[1]])
    wrapper.unmount()
  })
  it('reports a failed PDF and can retry its rendering without changing selection', async () => {
    getAll.mockResolvedValue({ data: records })
    const wrapper = await setup()
    wrapper.getComponent({ name: 'VuePdfEmbed' }).vm.$emit('loading-failed', new Error('PDF'))
    await flushPromises()
    expect(wrapper.text()).toContain('원본 PDF로 확인하세요.')
    expect(wrapper.get('iframe').attributes('src')).toBe('/one.pdf')
    expect(wrapper.get('iframe').attributes('title')).toBe('첫 번째 문서 원본 PDF')
    await wrapper.get('[data-pdf-retry]').trigger('click')
    expect(wrapper.text()).not.toContain('원본 PDF로 확인하세요.')
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('one')
    expect(wrapper.get('a[download]').attributes('href')).toBe('/one.pdf')
    wrapper.unmount()
  })
})
