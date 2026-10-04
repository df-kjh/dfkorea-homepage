import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createMemoryHistory, RouterLink } from 'vue-router'
import TheNavigation from './TheNavigation.vue'

const wrappers: VueWrapper[] = []
const originalWidth = window.innerWidth
async function setup(path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  const wrapper = mount(TheNavigation, {
    attachTo: document.body,
    global: { plugins: [router], stubs: { NuxtLink: RouterLink } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
})
describe('public navigation', () => {
  it('observes a newly resolved home Hero and ignores late callbacks from a departed route', async () => {
    const callbacks: IntersectionObserverCallback[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          callbacks.push(callback)
        }
        observe() {}
        disconnect() {}
      },
    )
    const content = document.createElement('main')
    content.id = 'public-content'
    document.body.append(content)
    const { wrapper, router } = await setup('/')
    expect(wrapper.get('[data-site-header]').attributes('data-tone')).toBe('paper')
    content.innerHTML = '<section data-light-hero></section>'
    await new Promise((resolve) => setTimeout(resolve, 0))
    callbacks[0]?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await flushPromises()
    expect(wrapper.get('[data-site-header]').attributes('data-tone')).toBe('ink')
    await router.push('/products')
    await flushPromises()
    callbacks[0]?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await flushPromises()
    expect(wrapper.get('[data-site-header]').attributes('data-tone')).toBe('paper')
    content.replaceChildren()
    await router.push('/')
    await flushPromises()
    content.innerHTML = '<section data-light-hero></section>'
    await new Promise((resolve) => setTimeout(resolve, 0))
    callbacks[1]?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await flushPromises()
    expect(wrapper.get('[data-site-header]').attributes('data-tone')).toBe('ink')
  })
  it('keeps the four real routes and marks a detail page parent current', async () => {
    const { wrapper } = await setup('/products/example')
    const links = wrapper.findAll('.public-nav__desktop a')
    expect(links.map((link) => link.attributes('href'))).toEqual([
      '/about',
      '/products',
      '/certificates',
      '/blog',
    ])
    expect(links.map((link) => link.text())).toEqual(['회사소개', '제품', '인증', '소식'])
    expect(links[1]?.attributes('aria-current')).toBe('page')
    expect(wrapper.get('[data-site-header]').attributes('data-tone')).toBe('paper')
  })
  it('supports mobile disclosure, Escape focus return, route close and desktop reset', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    const { wrapper, router } = await setup('/about')
    const toggle = wrapper.get('[data-menu-toggle]')
    expect(toggle.attributes('aria-controls')).toBe('public-mobile-navigation')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    ;(wrapper.get('.public-nav__mobile a').element as HTMLAnchorElement).focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle.element)
    await toggle.trigger('click')
    await router.push('/blog')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })
})
