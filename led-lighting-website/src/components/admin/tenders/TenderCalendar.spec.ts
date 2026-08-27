import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TenderCalendar from './TenderCalendar.vue'

describe('TenderCalendar', () => {
  it('renders all six weeks and selects a registered date', async () => {
    const wrapper = mount(TenderCalendar, {
      props: {
        month: '2026-08',
        selectedDate: '2026-08-27',
        days: [
          { date: '2026-08-27', total: 3, direct: 2, potential: 1 },
          { date: '2026-08-28', total: 1, direct: 0, potential: 1 },
        ],
      },
    })

    expect(wrapper.findAll('[data-test="calendar-cell"]')).toHaveLength(42)
    expect(wrapper.findAll('[data-test="calendar-week"]')).toHaveLength(6)
    expect(wrapper.get('[data-date="2026-07-26"]').classes()).toContain('is-outside-month')
    expect(wrapper.get('[data-date="2026-08-27"]').text()).toContain('2')
    expect(wrapper.get('[data-date="2026-08-27"]').text()).toContain('1')

    await wrapper.get('[data-date="2026-08-28"]').trigger('click')
    expect(wrapper.emitted('select-date')).toEqual([['2026-08-28']])
  })

  it('moves to the adjacent month when its visible date is selected', async () => {
    const wrapper = mount(TenderCalendar, {
      props: { month: '2026-08', selectedDate: '2026-08-27', days: [] },
    })

    await wrapper.get('[data-date="2026-09-01"]').trigger('click')

    expect(wrapper.emitted('change-month')).toEqual([['2026-09']])
    expect(wrapper.emitted('select-date')).toEqual([['2026-09-01']])
  })
})
