import { describe, expect, it } from 'vitest'
import { formatKstDate, formatKstDateTime, formatTenderAmount } from './tender-format'

describe('tender display formatting', () => {
  it('uses Asia/Seoul consistently across a UTC calendar boundary', () => {
    const instant = '2026-08-31T15:30:00.000Z'

    expect(formatKstDate(instant)).toBe('2026. 9. 1.')
    expect(formatKstDateTime(instant)).toBe('2026. 9. 1. 00:30')
  })

  it('formats PostgreSQL bigint decimal strings without precision loss', () => {
    expect(formatTenderAmount('9007199254740993123456789')).toBe(
      '9,007,199,254,740,993,123,456,789원',
    )
    expect(formatTenderAmount(null)).toBe('-')
  })
})
