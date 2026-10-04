import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CertificatesView from './CertificatesView.vue'

const getAll = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ certificatesAPI: { getAll } }))
beforeEach(() => getAll.mockReset())
const mountList = () =>
  mount(CertificatesView, {
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })

describe('certificate collection', () => {
  it('shows a truthful failed request and retries instead of reporting empty records', async () => {
    getAll
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        data: [
          { id: 'one', name: '등록 문서', category: 'KS % 인증', certificatePdf: '/document.pdf' },
        ],
      })
    const wrapper = mountList()
    await flushPromises()
    expect(wrapper.text()).toContain('인증 자료를 불러오지 못했습니다')
    expect(wrapper.text()).not.toContain('등록된 인증서가 없습니다')
    await wrapper.get('[data-certificate-retry]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-certificate-category]').attributes('href')).toBe(
      `/certificates/${encodeURIComponent('KS % 인증')}`,
    )
    expect(wrapper.text()).toContain('1개의 등록 문서')
    wrapper.unmount()
  })
})
