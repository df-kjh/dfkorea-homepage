import { describe, expect, it } from 'vitest'
import { buildMonthCells } from './tender-calendar'

describe('buildMonthCells', () => {
  it('always builds six complete weeks for August 2026', () => {
    const cells = buildMonthCells(2026, 7, new Map())

    expect(cells).toHaveLength(42)
    expect(cells[0]).toMatchObject({ date: '2026-07-26', inCurrentMonth: false })
    expect(cells[41]).toMatchObject({ date: '2026-09-05', inCurrentMonth: false })
    expect(cells.filter((cell) => cell.inCurrentMonth)).toHaveLength(31)
  })

  it('keeps leap-year February dates and API counts on their local calendar dates', () => {
    const cells = buildMonthCells(
      2024,
      1,
      new Map([
        ['2024-02-01', { date: '2024-02-01', total: 3, direct: 2, potential: 1 }],
        ['2024-02-29', { date: '2024-02-29', total: 1, direct: 0, potential: 1 }],
      ]),
    )

    expect(cells[0]).toMatchObject({ date: '2024-01-28', inCurrentMonth: false })
    expect(cells[4]).toMatchObject({ date: '2024-02-01', total: 3, direct: 2, potential: 1 })
    expect(cells[32]).toMatchObject({ date: '2024-02-29', total: 1, direct: 0, potential: 1 })
    expect(cells[41]).toMatchObject({ date: '2024-03-09', inCurrentMonth: false })
  })

  it('rolls leading dates into the prior year without UTC date shifts', () => {
    const cells = buildMonthCells(2026, 0, new Map())

    expect(cells[0]?.date).toBe('2025-12-28')
    expect(cells[4]).toMatchObject({ date: '2026-01-01', inCurrentMonth: true })
    expect(cells[41]?.date).toBe('2026-02-07')
  })
})
