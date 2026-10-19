// @vitest-environment node
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ControlSimulation from './ControlSimulation.vue'

describe('server-rendered control simulation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it.each(['발전기 비상', '밧데리 비상', '배터리 비상'])(
    'does not leave a countdown timer after rendering %s',
    async (option) => {
      const html = await renderToString(createSSRApp(ControlSimulation, { option }))
      expect(html).toContain('전원 전환 대기')
      expect(html).not.toContain('data-powered="true"')
      expect(vi.getTimerCount()).toBe(0)
    },
  )
})
