import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomeView from '@/views/HomeView.vue'

const boundary = vi.hoisted(() => ({ getFeatured: vi.fn(), error: vi.fn() }))
vi.mock('@/api', () => ({ productsAPI: { getFeatured: boundary.getFeatured } }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: boundary.error }) }))

const homes: ReturnType<typeof mount>[] = []
beforeEach(() => vi.resetAllMocks())
afterEach(() => homes.splice(0).forEach((home) => home.unmount()))

async function renderHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  const home = mount(HomeView, {
    global: {
      plugins: [router],
      stubs: {
        HeroSection: true,
        StatsSection: true,
        ClientsSection: true,
        FeatureSection: true,
        ProductCarousel: true,
        CtaSection: true,
        LoadingSpinner: true,
        EmptyState: true,
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  homes.push(home)
  await flushPromises()
  return home
}

describe('home Kinda introduction', () => {
  it.each(['loading', 'products', 'empty', 'error'])(
    'keeps the service introduction before contact when products are %s',
    async (state) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      if (state === 'loading') boundary.getFeatured.mockReturnValue(new Promise(() => {}))
      else if (state === 'error') boundary.getFeatured.mockRejectedValue(new Error('offline'))
      else if (state === 'products')
        boundary.getFeatured.mockResolvedValue({ data: [{ id: 'example-product' }] })
      else boundary.getFeatured.mockResolvedValue({ data: [] })
      try {
        const home = await renderHome()
        const section = home.find('section[aria-labelledby="kinda-title"]')
        expect(section.exists()).toBe(true)
        if (state === 'products') {
          expect(home.html().indexOf('<product-carousel-stub')).toBeLessThan(
            home.html().indexOf('id="kinda-section"'),
          )
        }
        expect(home.html().indexOf('id="kinda-section"')).toBeLessThan(
          home.html().indexOf('<cta-section-stub'),
        )
        const link = section.get('a[aria-label="킨다 서비스 알아보기, 새 창"]')
        expect(link.attributes('href')).toBe('https://kinda.dfkorealed.com/')
        expect(link.attributes('rel')).toBe('noopener noreferrer')
        expect(section.text()).not.toContain('시설 관리자 · 조명 시공 및 유통 파트너를 위해')
        expect(section.text()).not.toContain('빛의 상태를 보고, 필요한 곳을 제어합니다.')
      } finally {
        log.mockRestore()
      }
    },
  )

  it('supports keyboard tab navigation and shows one feature example at a time', async () => {
    boundary.getFeatured.mockResolvedValue({ data: [] })
    const home = await renderHome()
    const tabs = home.findAll('[role="tab"]')
    expect(tabs).toHaveLength(3)
    await tabs[1]!.trigger('keydown', { key: 'ArrowRight' })
    expect(tabs[2]!.attributes('aria-selected')).toBe('true')
    expect(tabs[2]!.attributes('tabindex')).toBe('0')
    expect(home.get('#demo-history').attributes('hidden')).toBeUndefined()
    expect(home.get('#demo-control').attributes('hidden')).toBeDefined()
    await tabs[2]!.trigger('keydown', { key: 'Home' })
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    expect(home.get('#demo-monitor').attributes('hidden')).toBeUndefined()
  })

  it('previews brightness locally and announces the example without calling a control service', async () => {
    boundary.getFeatured.mockResolvedValue({ data: [] })
    const home = await renderHome()
    const slider = home.find('input[aria-label="예시 조명 밝기"]')
    expect(slider.exists()).toBe(true)
    expect(home.text()).toContain('실제 조명은 제어하지 않습니다.')
    await slider.setValue('100')
    expect(home.get('output').text()).toBe('100%')
    await home.get('#demo-apply').trigger('click')
    expect(home.get('[role="status"]#demo-feedback').text()).toBe(
      '화면 예시: 선택한 조명 6개를 100%로 표시합니다.',
    )
    expect(home.findAll('.lamp.is-selected')).toHaveLength(6)
    await slider.setValue('20')
    expect(home.get('#demo-feedback').attributes('hidden')).toBeDefined()
    expect(boundary.getFeatured).toHaveBeenCalledTimes(1)
  })
})
