import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import ProductCarousel from './ProductCarousel.vue'

afterEach(() => vi.restoreAllMocks())
it('disables both arrow controls when the loaded products fit without scrolling', () => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(300)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
  const carousel = mount(ProductCarousel, {
    props: { products: [] },
    global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } },
  })
  const arrows = carousel.findAll('button')
  expect(arrows).toHaveLength(2)
  expect(arrows.every((button) => button.attributes('disabled') !== undefined)).toBe(true)
  expect(arrows[0]!.attributes('aria-label')).toContain('이전')
  carousel.unmount()
})
