import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { h, type Component } from 'vue'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { PaginatedResponse } from '@/types'

// Both public lists must reconcile their build snapshot before using live offsets.
// Keep their real cards, router links and infinite-scroll composable in this contract.
export function testSeededListRefresh<T extends { id: string }>(options: {
  view: Component
  path: string
  item: (id: string) => T
  getPaginated: Mock
}) {
  const { view, path, item, getPaginated } = options
  const page = (ids: string[], total: number, number = 1): PaginatedResponse<T> => ({
    data: ids.map(item),
    total,
    page: number,
    limit: 2,
    totalPages: Math.ceil(total / 2),
  })
  let intersections: IntersectionObserverCallback[]
  let notifyOnObserve: boolean
  let wrapper: VueWrapper | undefined

  async function mountSeed(total: number) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { render: () => h('div') } }],
    })
    await router.push(path)
    await router.isReady()
    wrapper = mount(view, {
      props: { initialPage: page(['a', 'b'], total) },
      global: { plugins: [router], components: { NuxtLink: RouterLink } },
    })
    return wrapper
  }
  const links = () => wrapper!.findAll(`a[href^="${path}/"]`).map((link) => link.attributes('href'))
  const enter = () =>
    intersections.at(-1)?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )

  beforeEach(() => {
    getPaginated.mockReset()
    intersections = []
    notifyOnObserve = false
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private callback: IntersectionObserverCallback) {
          intersections.push(callback)
        }
        observe() {
          // An observer reports initial visibility, then only reports threshold crossings.
          if (notifyOnObserve)
            queueMicrotask(() =>
              this.callback(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                {} as IntersectionObserver,
              ),
            )
        }
        unobserve() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('SSR seed refresh before live pagination', () => {
    it('reobserves a visible sentinel after refresh without requiring another scroll', async () => {
      notifyOnObserve = true
      let resolve!: (value: { data: PaginatedResponse<T> }) => void
      getPaginated
        .mockImplementationOnce(
          () =>
            new Promise((done) => {
              resolve = done
            }),
        )
        .mockResolvedValueOnce({ data: page(['b'], 3, 2) })
      await mountSeed(3)
      await flushPromises()
      expect(links()).toEqual([`${path}/a`, `${path}/b`])
      expect(getPaginated).toHaveBeenCalledTimes(1)
      resolve({ data: page(['new', 'a'], 3) })
      await flushPromises()
      expect(links()).toEqual([`${path}/new`, `${path}/a`, `${path}/b`])
      expect(getPaginated.mock.calls.map((args) => args.slice(0, 2))).toEqual([
        [1, 2],
        [2, 2],
      ])
    })

    it.each([
      {
        change: 'insertion after an exhausted seed',
        seedTotal: 2,
        fresh: ['new', 'a'],
        total: 3,
        next: ['b'],
      },
      {
        change: 'insertion before an existing page boundary',
        seedTotal: 3,
        fresh: ['new', 'a'],
        total: 4,
        next: ['b', 'c'],
      },
      {
        change: 'deletion before an existing page boundary',
        seedTotal: 4,
        fresh: ['b', 'c'],
        total: 3,
        next: ['d'],
      },
    ])(
      'replaces the seed after $change before appending page 2',
      async ({ seedTotal, fresh, total, next }) => {
        let resolve!: (value: { data: PaginatedResponse<T> }) => void
        getPaginated
          .mockImplementationOnce(
            () =>
              new Promise((done) => {
                resolve = done
              }),
          )
          .mockResolvedValueOnce({ data: page(next, total, 2) })
        await mountSeed(seedTotal)
        const first = wrapper!.get(`a[href="${path}/a"]`).element
        await flushPromises()
        expect(getPaginated.mock.calls.map((args) => args.slice(0, 2))).toEqual([[1, 2]])
        expect(wrapper!.get(`a[href="${path}/a"]`).element).toBe(first)
        expect(links()).toEqual([`${path}/a`, `${path}/b`])
        enter()
        await flushPromises()
        expect(getPaginated).toHaveBeenCalledTimes(1)

        resolve({ data: page(fresh, total) })
        await flushPromises()
        expect(links()).toEqual(fresh.map((id) => `${path}/${id}`))
        enter()
        await flushPromises()
        expect(getPaginated.mock.calls.map((args) => args.slice(0, 2))).toEqual([
          [1, 2],
          [2, 2],
        ])
        expect(links()).toEqual([...fresh, ...next].map((id) => `${path}/${id}`))
        expect(new Set(links()).size).toBe(total)
        enter()
        await flushPromises()
        expect(getPaginated).toHaveBeenCalledTimes(2)
      },
    )

    it('stops pagination when the refreshed total is exhausted after deletion', async () => {
      getPaginated.mockResolvedValueOnce({ data: page(['b', 'c'], 2) })
      await mountSeed(3)
      await flushPromises()
      expect(links()).toEqual([`${path}/b`, `${path}/c`])
      enter()
      await flushPromises()
      expect(getPaginated.mock.calls.map((args) => args.slice(0, 2))).toEqual([[1, 2]])
    })

    it('blocks stale continuation when refresh fails and retries page 1', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      getPaginated
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({ data: page(['new', 'a'], 3) })
        .mockResolvedValueOnce({ data: page(['b'], 3, 2) })
      await mountSeed(3)
      await flushPromises()
      enter()
      await flushPromises()
      expect(getPaginated.mock.calls.map((args) => args.slice(0, 2))).toEqual([[1, 2]])
      const retry = wrapper!.findAll('button').find((button) => button.text() === '다시 시도')
      expect(retry).toBeDefined()
      await retry!.trigger('click')
      await flushPromises()
      expect(links()).toEqual([`${path}/new`, `${path}/a`])
      enter()
      await flushPromises()
      expect(getPaginated.mock.calls.map((args) => args.slice(0, 2))).toEqual([
        [1, 2],
        [1, 2],
        [2, 2],
      ])
      expect(links()).toEqual([`${path}/new`, `${path}/a`, `${path}/b`])
    })
  })
}
