import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DetailControl from './DetailControl.vue'

const options = ['개별디밍', '그룹디밍', '발전기 비상', '밧데리 비상', '센서']
const render = (registered = options) =>
  mount(DetailControl, { props: { title: '제어', options: registered }, attachTo: document.body })
const tick = async (milliseconds: number) => {
  await vi.advanceTimersByTimeAsync(milliseconds)
  await nextTick()
}

describe('registered control option concepts', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('changes options by keyboard while preserving one selected tab and its panel label', async () => {
    const wrapper = render(['개별디밍', '그룹디밍', '센서'])
    expect(wrapper.get('[aria-selected="true"]').text()).toContain('그룹디밍')
    await wrapper.get('[aria-selected="true"]').trigger('keydown', { key: 'End' })
    const selected = wrapper.get('[aria-selected="true"]')
    expect(selected.text()).toContain('센서')
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(
      selected.attributes('id'),
    )
    expect(document.activeElement).toBe(selected.element)
    await selected.trigger('keydown', { key: 'Home' })
    expect(wrapper.get('[aria-selected="true"]').text()).toContain('개별디밍')
    wrapper.unmount()
  })

  it('dims only alternate lamps with different phases, leaving the other three off', async () => {
    const wrapper = render(['개별디밍'])
    const lamps = wrapper.findAll('[data-lamp]')
    expect(lamps).toHaveLength(6)
    expect(lamps.map((lamp) => lamp.attributes('data-powered'))).toEqual([
      'true',
      'false',
      'true',
      'false',
      'true',
      'false',
    ])
    const active = lamps.filter((lamp) => lamp.attributes('data-powered') === 'true')
    expect(active.every((lamp) => lamp.classes().includes('is-dimming'))).toBe(true)
    expect(
      new Set(active.map((lamp) => (lamp.element as HTMLElement).style.animationDelay)).size,
    ).toBe(3)
    expect(
      lamps
        .filter((lamp) => lamp.attributes('data-powered') === 'false')
        .every((lamp) => !lamp.classes().includes('is-dimming')),
    ).toBe(true)
    wrapper.unmount()
  })

  it('keeps the group to three lamps in one row with the same dimming phase', () => {
    const wrapper = render()
    const lamps = wrapper.findAll('[data-lamp]')
    expect(lamps).toHaveLength(3)
    expect(lamps.every((lamp) => lamp.classes().includes('is-dimming'))).toBe(true)
    expect(lamps.map((lamp) => (lamp.element as HTMLElement).style.animationDelay)).toEqual([
      '0s',
      '0s',
      '0s',
    ])
    wrapper.unmount()
  })

  it.each(['발전기 비상', '밧데리 비상', '배터리 비상'])(
    '%s turns on at exactly 1000 ms and remains bright',
    async (option) => {
      const wrapper = render([option])
      expect(wrapper.find('[data-lamp].is-on').exists()).toBe(false)
      await tick(999)
      expect(wrapper.find('[data-lamp].is-on').exists()).toBe(false)
      await tick(1)
      expect(wrapper.findAll('[data-lamp].is-on')).toHaveLength(3)
      await tick(15000)
      expect(wrapper.findAll('[data-lamp].is-on')).toHaveLength(3)
      expect(vi.getTimerCount()).toBe(0)
      wrapper.unmount()
    },
  )

  it('cleans up an emergency when switching tabs and restarts it on reentry', async () => {
    const wrapper = render(['발전기 비상', '센서'])
    await tick(700)
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(vi.getTimerCount()).toBe(0)
    await tick(800)
    await wrapper.findAll('[role="tab"]')[0]!.trigger('click')
    expect(wrapper.find('[data-lamp].is-on').exists()).toBe(false)
    await tick(999)
    expect(wrapper.find('[data-lamp].is-on').exists()).toBe(false)
    await tick(1)
    expect(wrapper.findAll('[data-lamp].is-on')).toHaveLength(3)
    wrapper.unmount()
  })

  it('pauses the emergency countdown, resumes its remaining time, and can restart it', async () => {
    const wrapper = render(['발전기 비상'])
    await tick(600)
    expect(wrapper.find('[aria-label="애니메이션 일시정지"]').exists()).toBe(true)
    await wrapper.get('[aria-label="애니메이션 일시정지"]').trigger('click')
    await tick(2000)
    expect(wrapper.find('[data-lamp].is-on').exists()).toBe(false)
    await wrapper.get('[aria-label="애니메이션 재생"]').trigger('click')
    await tick(399)
    expect(wrapper.find('[data-lamp].is-on').exists()).toBe(false)
    await tick(1)
    expect(wrapper.findAll('[data-lamp].is-on')).toHaveLength(3)
    await wrapper.get('[aria-label="애니메이션 다시보기"]').trigger('click')
    expect(wrapper.find('[data-lamp].is-on').exists()).toBe(false)
    await tick(1000)
    expect(wrapper.findAll('[data-lamp].is-on')).toHaveLength(3)
    wrapper.unmount()
  })

  it('pauses continuous dimming through the shared control', async () => {
    const wrapper = render(['개별디밍'])
    expect(wrapper.find('[data-play-state="running"]').exists()).toBe(true)
    await wrapper.get('[aria-label="애니메이션 일시정지"]').trigger('click')
    expect(wrapper.find('[data-play-state="paused"]').exists()).toBe(true)
    await wrapper.get('[aria-label="애니메이션 재생"]').trigger('click')
    expect(wrapper.find('[data-play-state="running"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('releases the pending emergency timer when unmounted', () => {
    const wrapper = render(['발전기 비상'])
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses static dimming for reduced motion and retains the one-shot emergency transition', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }))
    const wrapper = render(['개별디밍', '발전기 비상'])
    await nextTick()
    expect(wrapper.find('[data-motion="reduced"]').exists()).toBe(true)
    expect(wrapper.find('[data-lamp].is-dimming').exists()).toBe(false)
    expect(wrapper.findAll('[data-powered="true"]')).toHaveLength(3)
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await tick(999)
    expect(wrapper.find('[data-lamp].is-on').exists()).toBe(false)
    await tick(1)
    expect(wrapper.findAll('[data-lamp].is-on')).toHaveLength(3)
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })

  it('resets the active option when a different product has fewer registered controls', async () => {
    const wrapper = render()
    await wrapper.setProps({ options: ['발전기 비상'] })
    expect(wrapper.get('[aria-selected="true"]').text()).toContain('발전기 비상')
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(
      wrapper.get('[aria-selected="true"]').attributes('id'),
    )
    await tick(999)
    expect(wrapper.find('[data-lamp].is-on').exists()).toBe(false)
    await tick(1)
    expect(wrapper.findAll('[data-lamp].is-on')).toHaveLength(3)
    wrapper.unmount()
  })

  it('never adds a control option absent from the registered product', () => {
    const wrapper = render(['센서'])
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      expect.stringContaining('센서'),
    ])
    expect(wrapper.text()).not.toContain('그룹디밍')
    expect(wrapper.text()).not.toContain('발전기 비상')
    wrapper.unmount()
  })
})
