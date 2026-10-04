import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PublicAction from './PublicAction.vue'
import PublicPageHeader from './PublicPageHeader.vue'

const link = { props: ['to'], template: '<a :href="to"><slot /></a>' }
describe('public site primitives', () => {
  it('forwards native button attributes and a single click', async () => {
    const click = vi.fn()
    const wrapper = mount(PublicAction, {
      props: { type: 'submit' },
      attrs: { 'aria-label': '확인', onClick: click },
      slots: { default: '확인하기' },
    })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('submit')
    expect(wrapper.attributes('aria-label')).toBe('확인')
    await wrapper.trigger('click')
    expect(click).toHaveBeenCalledTimes(1)
  })
  it('keeps routed and external actions real anchors with their attributes', () => {
    const routed = mount(PublicAction, {
      props: { to: '/products' },
      global: { stubs: { NuxtLink: link } },
    })
    expect(routed.attributes('href')).toBe('/products')
    const external = mount(PublicAction, {
      props: { href: '/document.pdf', variant: 'text' },
      attrs: { download: '문서.pdf', target: '_blank' },
    })
    expect(external.element.tagName).toBe('A')
    expect(external.attributes('download')).toBe('문서.pdf')
    expect(external.attributes('target')).toBe('_blank')
  })
  it('uses one text heading and keeps an actions slot and routed back link', () => {
    const wrapper = mount(PublicPageHeader, {
      props: { eyebrow: 'DOCUMENTS', title: '기준과\n기록.', backTo: '/certificates' },
      slots: { actions: '<button>선택하기</button>' },
      global: { stubs: { NuxtLink: link } },
    })
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('h1').text()).toBe('기준과\n기록.')
    expect(wrapper.get('a').attributes('href')).toBe('/certificates')
    expect(wrapper.get('button').text()).toBe('선택하기')
  })
})
