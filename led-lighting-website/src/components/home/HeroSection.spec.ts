import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HeroSection from './HeroSection.vue'

describe('HeroSection', () => {
  const originalInnerHeight = window.innerHeight

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
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
          ParkingGarageScene: { template: '<div />' },
        },
      },
    })

  it('replaces the video request while retaining visible Hero content and the primary action', async () => {
    const wrapper = mountHero()

    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.find('source[src="/videos/HeroSection.mp4"]').exists()).toBe(false)
    expect(wrapper.findAll('.pointer-events-none')).toHaveLength(2)
    expect(wrapper.text()).toContain('주차장을 밝히는 빛')
    expect(wrapper.text()).toContain('LED 조명 솔루션')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('primaryClick')).toEqual([[]])
    wrapper.unmount()
  })

  it('smoothly scrolls down from the retained scroll control', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1_000 })
    const wrapper = mountHero()

    await wrapper.get('[data-test="hero-scroll-down"]').trigger('click')

    expect(scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'smooth' })
    wrapper.unmount()
  })
})
