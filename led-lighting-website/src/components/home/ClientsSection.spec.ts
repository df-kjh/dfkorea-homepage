import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ClientsSection from './ClientsSection.vue'

const clients = [
  { name: '파트너 A', logo: '/a.svg' },
  { name: '파트너 B', logo: '/b.svg' },
]

describe('partner carousel', () => {
  it('lets visitors pause and resume the moving logos', async () => {
    const wrapper = mount(ClientsSection, { props: { clients } })
    const control = wrapper.get('button')

    expect(control.attributes('aria-pressed')).toBe('false')
    await control.trigger('click')
    expect(control.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.partners-track').attributes('data-paused')).toBe('true')
    expect(control.attributes('aria-label')).toBe('파트너 로고 재생')
    await control.trigger('click')
    expect(wrapper.get('.partners-track').attributes('data-paused')).toBe('false')
    wrapper.unmount()
  })

  it('hides loop copies from assistive technology and keeps the current partner list reactive', async () => {
    const wrapper = mount(ClientsSection, { props: { clients } })
    expect(
      wrapper.findAll('ul:not([aria-hidden]) img').map((logo) => logo.attributes('alt')),
    ).toEqual(['파트너 A 로고', '파트너 B 로고'])
    expect(
      wrapper
        .get('ul[aria-hidden="true"]')
        .findAll('img')
        .every((logo) => logo.attributes('alt') === ''),
    ).toBe(true)

    await wrapper.setProps({ clients: [{ name: '파트너 C', logo: '/c.svg' }] })
    expect(wrapper.findAll('img').map((logo) => logo.attributes('src'))).toEqual([
      '/c.svg',
      '/c.svg',
    ])
    wrapper.unmount()
  })

  it('replaces a failed logo with its partner name in both loop groups', async () => {
    const wrapper = mount(ClientsSection, { props: { clients } })
    await wrapper.get('img[src="/a.svg"]').trigger('error')
    expect(wrapper.findAll('img[src="/a.svg"]')).toHaveLength(0)
    expect(wrapper.findAll('.partner-name').map((name) => name.text())).toEqual([
      '파트너 A',
      '파트너 A',
    ])
    wrapper.unmount()
  })
})
