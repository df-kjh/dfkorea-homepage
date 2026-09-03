import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HeroSection from './HeroSection.vue'

describe('HeroSection', () => {
  const originalInnerHeight = window.innerHeight
  const originalScrollY = window.scrollY

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: originalScrollY,
    })
  })

  const mountHero = () =>
    mount(HeroSection, {
      props: {
        title: '주차장을 밝히는 빛',
        subtitle: 'LED 조명 솔루션',
        primaryButtonText: '제품 확인',
      },
      global: {
        stubs: {
          HangingBulbScene: {
            template: '<div data-test="hanging-bulb-stub" />',
          },
        },
      },
    })

  it('centers mobile copy over a subdued light and restores the split layout on wider screens', async () => {
    const wrapper = mountHero()

    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.get('.hero-shell').classes()).toContain('hero-shell--viewport-fill')
    expect(wrapper.get('[data-test="hero-layout"]').classes()).toEqual(
      expect.arrayContaining([
        'absolute',
        'inset-0',
        'flex',
        'py-20',
        'sm:relative',
        'sm:inset-auto',
        'sm:grid',
        'sm:h-full',
        'sm:pb-20',
        'sm:pt-28',
        'lg:grid-cols-2',
      ]),
    )
    expect(wrapper.get('[data-test="hero-copy"]').classes()).toEqual(
      expect.arrayContaining(['items-center', 'text-center', 'sm:block', 'sm:text-left']),
    )
    expect(wrapper.get('[data-test="hero-actions"]').classes()).toEqual(
      expect.arrayContaining(['justify-center', 'sm:justify-start']),
    )
    const visual = wrapper.get('[data-test="hero-visual"]')
    expect(visual.classes()).toEqual(
      expect.arrayContaining([
        'pointer-events-none',
        'absolute',
        'opacity-[0.32]',
        'sm:pointer-events-auto',
        'sm:relative',
        'sm:opacity-100',
      ]),
    )
    expect(visual.find('[data-test="hanging-bulb-stub"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('주차장을 밝히는 빛')
    expect(wrapper.text()).toContain('LED 조명 솔루션')

    const buttons = wrapper.get('[data-test="hero-copy"]').findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.text()).toContain('제품 확인')
    expect(buttons[1]?.text()).toContain('회사 소개')

    await buttons[0]?.trigger('click')
    await buttons[1]?.trigger('click')

    expect(wrapper.emitted('primaryClick')).toEqual([[]])
    expect(wrapper.emitted('secondaryClick')).toEqual([[]])
    wrapper.unmount()
  })

  it('blends the Hero background into the following light section', () => {
    const wrapper = mountHero()
    const transition = wrapper.get('[data-test="hero-transition"]')

    expect(transition.attributes('aria-hidden')).toBe('true')
    expect(transition.classes()).toContain('hero-transition')

    wrapper.unmount()
  })

  it('smoothly scrolls down from the retained scroll control', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 860,
    } as DOMRect)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 })
    const wrapper = mountHero()

    await wrapper.get('[data-test="hero-scroll-down"]').trigger('click')

    expect(scrollTo).toHaveBeenCalledWith({ top: 980, behavior: 'smooth' })
    wrapper.unmount()
  })

  it('uses immediate scrolling when reduced motion is requested', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 700,
    } as DOMRect)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 50 })
    const wrapper = mountHero()

    await wrapper.get('[data-test="hero-scroll-down"]').trigger('click')

    expect(scrollTo).toHaveBeenCalledWith({ top: 750, behavior: 'auto' })
    wrapper.unmount()
  })
})
