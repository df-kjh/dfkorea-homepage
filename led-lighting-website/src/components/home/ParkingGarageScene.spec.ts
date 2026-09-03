import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createParkingGarageController = vi.hoisted(() => vi.fn())

vi.mock('./parking-garage/parkingGarageScene', () => ({
  createParkingGarageController,
}))

import ParkingGarageScene from './ParkingGarageScene.vue'

describe('ParkingGarageScene', () => {
  const controller = {
    dispose: vi.fn(),
    pause: vi.fn(),
    start: vi.fn(),
  }
  const mediaQuery = {
    addEventListener: vi.fn(),
    matches: true,
    removeEventListener: vi.fn(),
  }
  let intersectionCallback: IntersectionObserverCallback | null = null
  const disconnectIntersectionObserver = vi.fn()
  const observeIntersection = vi.fn()

  const installIntersectionObserver = () => {
    class IntersectionObserverMock implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = [0]

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback
      }

      disconnect = disconnectIntersectionObserver
      observe = observeIntersection
      takeRecords = () => []
      unobserve = vi.fn()
    }

    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
  }

  const setSceneIntersection = (isIntersecting: boolean) => {
    const target = observeIntersection.mock.calls[0]?.[0]
    if (!intersectionCallback || !target) {
      throw new Error('ParkingGarageScene did not register an IntersectionObserver')
    }

    intersectionCallback(
      [{ isIntersecting, target } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    intersectionCallback = null
    createParkingGarageController.mockReturnValue(controller)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts the controller after mount with the renderer container and motion preference, then cleans up', () => {
    expect(createParkingGarageController).not.toHaveBeenCalled()

    const wrapper = mount(ParkingGarageScene)
    const renderer = wrapper.get('[data-test="parking-garage-renderer"]')

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    expect(createParkingGarageController).toHaveBeenCalledWith(
      expect.objectContaining({
        container: renderer.element,
        reducedMotion: true,
      }),
    )
    expect(controller.start).toHaveBeenCalledOnce()
    expect(mediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    const motionListener = mediaQuery.addEventListener.mock.calls[0]?.[1]
    wrapper.unmount()

    expect(controller.dispose).toHaveBeenCalledOnce()
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', motionListener)
  })

  it('pauses the controller offscreen and starts it again when the scene returns', () => {
    installIntersectionObserver()
    const wrapper = mount(ParkingGarageScene)

    expect(observeIntersection).toHaveBeenCalledWith(wrapper.element)
    expect(controller.start).toHaveBeenCalledOnce()

    setSceneIntersection(false)
    expect(controller.pause).toHaveBeenCalledOnce()

    setSceneIntersection(true)
    expect(controller.start).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('disconnects its viewport observer on unmount', () => {
    installIntersectionObserver()
    const wrapper = mount(ParkingGarageScene)

    wrapper.unmount()

    expect(disconnectIntersectionObserver).toHaveBeenCalledOnce()
  })

  it('shows the eager fallback until the first rendered frame is ready', async () => {
    const wrapper = mount(ParkingGarageScene)
    const picture = wrapper.get('picture')
    const source = picture.get('source')
    const image = picture.get('img')
    const renderer = wrapper.get('[data-test="parking-garage-renderer"]')

    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('style')).toContain('touch-action: pan-y')
    expect(source.attributes()).toMatchObject({
      srcset: '/images/home/parking-garage-fallback-v2.jpg',
      type: 'image/jpeg',
    })
    expect(image.attributes()).toMatchObject({
      alt: '',
      loading: 'eager',
      src: '/images/main-hero.jpg',
    })
    expect(renderer.classes()).toContain('opacity-0')

    const options = createParkingGarageController.mock.calls[0]?.[0]
    options.onReady()
    await nextTick()

    expect(renderer.classes()).toContain('opacity-100')
    expect(wrapper.find('picture').exists()).toBe(true)
    wrapper.unmount()
  })

  it('returns to the static fallback when the controller reports a runtime fallback', async () => {
    const wrapper = mount(ParkingGarageScene)
    const options = createParkingGarageController.mock.calls[0]?.[0]

    options.onReady()
    await nextTick()
    options.onFallback('runtime')
    await nextTick()

    expect(wrapper.get('[data-test="parking-garage-renderer"]').classes()).toContain('opacity-0')
    expect(wrapper.find('picture').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not restart after terminal fallback when the motion preference changes', () => {
    const wrapper = mount(ParkingGarageScene)
    const options = createParkingGarageController.mock.calls[0]?.[0]
    const motionListener = mediaQuery.addEventListener.mock.calls[0]?.[1]

    options.onFallback('runtime')
    motionListener({ matches: false } as MediaQueryListEvent)

    expect(createParkingGarageController).toHaveBeenCalledOnce()
    expect(controller.start).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('does not restart from an intersection change after terminal fallback', () => {
    installIntersectionObserver()
    const wrapper = mount(ParkingGarageScene)
    const options = createParkingGarageController.mock.calls[0]?.[0]

    options.onFallback('runtime')
    setSceneIntersection(false)
    setSceneIntersection(true)

    expect(controller.start).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('restarts at the new motion preference when the system setting changes', () => {
    const wrapper = mount(ParkingGarageScene)
    const motionListener = mediaQuery.addEventListener.mock.calls[0]?.[1]

    motionListener({ matches: false } as MediaQueryListEvent)

    expect(controller.dispose).toHaveBeenCalledOnce()
    expect(createParkingGarageController).toHaveBeenCalledTimes(2)
    expect(createParkingGarageController.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ reducedMotion: false }),
    )
    expect(controller.start).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('recreates for reduced motion offscreen but waits to start until visible', () => {
    installIntersectionObserver()
    const firstController = {
      dispose: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
    }
    const replacementController = {
      dispose: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
    }
    createParkingGarageController
      .mockReturnValueOnce(firstController)
      .mockReturnValueOnce(replacementController)
    const wrapper = mount(ParkingGarageScene)
    const motionListener = mediaQuery.addEventListener.mock.calls[0]?.[1]

    setSceneIntersection(false)
    motionListener({ matches: false } as MediaQueryListEvent)

    expect(firstController.dispose).toHaveBeenCalledOnce()
    expect(createParkingGarageController).toHaveBeenCalledTimes(2)
    expect(replacementController.start).not.toHaveBeenCalled()

    setSceneIntersection(true)
    expect(replacementController.start).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
