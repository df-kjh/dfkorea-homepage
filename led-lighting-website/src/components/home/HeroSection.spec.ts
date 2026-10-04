import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HeroSection from './HeroSection.vue'
import { mountLightField } from './liquid-light/light-field'

vi.mock('./liquid-light/light-field', () => ({
  mountLightField: vi.fn(() => ({ dispose: vi.fn() })),
}))

describe('Liquid Light Hero integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })
  const mountHero = () =>
    mount(HeroSection, {
      props: {
        title: '빛의 새로운 흐름.',
        subtitle: '빛을 만드는 기술. 공간을 바꾸는 감각.',
        primaryButtonText: '제품 보기',
        secondaryButtonText: '회사 소개',
      },
      global: { stubs: { HangingBulbScene: true, NuxtLink: { template: '<a><slot /></a>' } } },
    })

  it('keeps one accessible heading and routes the original two home actions', async () => {
    const wrapper = mountHero()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('h1').attributes('aria-label')).toBe('빛의 새로운 흐름.')
    const actions = wrapper.get('[data-test="hero-actions"]').findAll('button')
    await actions[0]!.trigger('click')
    await actions[1]!.trigger('click')
    expect(wrapper.emitted('primaryClick')).toEqual([[]])
    expect(wrapper.emitted('secondaryClick')).toEqual([[]])
    wrapper.unmount()
  })

  it('mounts the field against actual hero/canvas/control refs and disposes on SPA unmount', () => {
    const wrapper = mountHero()
    expect(mountLightField).toHaveBeenCalledOnce()
    expect(vi.mocked(mountLightField).mock.calls[0]![0]).toMatchObject({
      hero: wrapper.get('[data-light-hero]').element,
      canvas: wrapper.get('[data-light-canvas]').element,
      control: wrapper.get('[data-motion-control]').element,
    })
    const controller = vi.mocked(mountLightField).mock.results[0]!.value
    wrapper.unmount()
    expect(controller.dispose).toHaveBeenCalledOnce()
  })

  it.each([false, true])('retains discover scrolling with reduced-motion=%s', async (reduced) => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reduced } as MediaQueryList)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 860,
    } as DOMRect)
    const wrapper = mountHero()
    await wrapper.get('[data-test="hero-scroll-down"]').trigger('click')
    expect(wrapper.emitted('scrollDown')).toEqual([[]])
    expect(scrollTo).toHaveBeenCalledWith({
      top: window.scrollY + 860,
      behavior: reduced ? 'auto' : 'smooth',
    })
    wrapper.unmount()
  })
})
