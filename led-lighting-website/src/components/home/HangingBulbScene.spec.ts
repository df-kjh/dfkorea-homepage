import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createHangingBulbController = vi.hoisted(() => vi.fn())

vi.mock('./hanging-bulb/createHangingBulbController', () => ({
  createHangingBulbController,
}))

import HangingBulbScene from './HangingBulbScene.vue'

describe('HangingBulbScene', () => {
  const controller = {
    dispose: vi.fn(),
    pause: vi.fn(),
    start: vi.fn(),
  }
  const mediaQuery = {
    addEventListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    createHangingBulbController.mockReturnValue(controller)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with the motion preference and disposes the renderer on unmount', () => {
    const wrapper = mount(HangingBulbScene)
    const renderer = wrapper.get('[data-test="hanging-bulb-renderer"]')

    expect(createHangingBulbController).toHaveBeenCalledWith(
      expect.objectContaining({
        container: renderer.element,
        reducedMotion: false,
      }),
    )
    expect(controller.start).toHaveBeenCalledOnce()

    wrapper.unmount()
    expect(controller.dispose).toHaveBeenCalledOnce()
  })

  it('shows only a ceiling drop cord and bulb fallback until WebGL is ready or after failure', async () => {
    const wrapper = mount(HangingBulbScene)
    const renderer = wrapper.get('[data-test="hanging-bulb-renderer"]')
    const fallback = wrapper.get('[data-test="hanging-bulb-fallback"]')
    const options = createHangingBulbController.mock.calls[0]?.[0]

    expect(fallback.find('[data-test="fallback-cable"]').exists()).toBe(true)
    expect(fallback.find('.fallback-cable__drop').exists()).toBe(false)
    expect(fallback.find('[data-test="fallback-bulb"]').exists()).toBe(true)
    expect(renderer.classes()).toContain('opacity-0')

    options.onReady()
    await nextTick()
    expect(renderer.classes()).toContain('opacity-100')
    expect(fallback.classes()).toContain('hanging-bulb__fallback--hidden')

    options.onFallback('runtime')
    await nextTick()
    expect(renderer.classes()).toContain('opacity-0')
    expect(fallback.classes()).not.toContain('hanging-bulb__fallback--hidden')
  })
})
