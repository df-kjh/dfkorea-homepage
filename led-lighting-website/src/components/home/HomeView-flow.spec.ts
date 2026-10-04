import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const boundary = vi.hoisted(() => ({ getFeatured: vi.fn(), error: vi.fn() }))
vi.mock('@/api', () => ({ productsAPI: { getFeatured: boundary.getFeatured } }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: boundary.error }) }))
beforeEach(() => vi.resetAllMocks())
async function renderHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  return shallowMount(HomeView, {
    global: {
      plugins: [router],
      stubs: { PublicAction: { template: '<button><slot /></button>' } },
    },
  })
}

it('shows a failed featured request separately from a real empty response and permits retry', async () => {
  boundary.getFeatured
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ data: [] })
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const home = await renderHome()
  await flushPromises()
  expect(home.find('[data-featured-error]').exists()).toBe(true)
  expect(home.findComponent({ name: 'EmptyState' }).exists()).toBe(false)
  await home.get('[data-featured-retry]').trigger('click')
  await flushPromises()
  expect(home.find('[data-featured-error]').exists()).toBe(false)
  expect(home.findComponent({ name: 'EmptyState' }).exists()).toBe(true)
  home.unmount()
  log.mockRestore()
})

it('does not publish an error toast from a featured request after leaving home', async () => {
  let reject!: (reason: Error) => void
  boundary.getFeatured.mockImplementation(
    () =>
      new Promise((_resolve, rejectRequest) => {
        reject = rejectRequest
      }),
  )
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const home = await renderHome()
  home.unmount()
  reject(new Error('late failure'))
  await flushPromises()
  expect(boundary.error).not.toHaveBeenCalled()
  log.mockRestore()
})
