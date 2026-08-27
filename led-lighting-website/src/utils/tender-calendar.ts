import type { TenderCalendarCell, TenderCalendarDay } from '@/types'

const formatCalendarDate = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Builds a Korean calendar from civil (not timestamp) dates. UTC accessors
 * intentionally keep YYYY-MM-DD labels stable regardless of the browser's
 * timezone; the API already aggregates registered dates in Asia/Seoul.
 */
export const buildMonthCells = (
  year: number,
  month: number,
  counts: ReadonlyMap<string, TenderCalendarDay>,
): TenderCalendarCell[] => {
  const firstDay = new Date(Date.UTC(year, month, 1))
  const firstSunday = new Date(Date.UTC(year, month, 1 - firstDay.getUTCDay()))

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstSunday)
    date.setUTCDate(firstSunday.getUTCDate() + index)
    const dateLabel = formatCalendarDate(date)
    const count = counts.get(dateLabel)

    return {
      date: dateLabel,
      inCurrentMonth: date.getUTCFullYear() === year && date.getUTCMonth() === month,
      total: count?.total ?? 0,
      direct: count?.direct ?? 0,
      potential: count?.potential ?? 0,
    }
  })
}
