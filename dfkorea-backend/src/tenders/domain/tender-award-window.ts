import { formatKstDate } from "../adapters/public-api-client";
import type { AwardWindow } from "../adapters/g2b-award.adapter";
const day = (date: Date) => date.toISOString().slice(0, 10);
export const kstDay = (date: Date) => {
  const value = formatKstDate(date);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
};
export function splitWindows(start: Date, end: Date): AwardWindow[] {
  const windows: AwardWindow[] = [];
  let cursor = start;
  while (cursor <= end) {
    const monthEnd = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
    );
    const stop = monthEnd < end ? monthEnd : end;
    windows.push({ start: day(cursor), end: day(stop) });
    cursor = new Date(stop.getTime() + 86400000);
  }
  return windows;
}
/** Date columns intentionally represent inclusive KST civil days, matching the
 * provider's minute-resolution inquiry and retaining both boundary days. */
export function monthlyAwardWindows(now: Date): AwardWindow[] {
  const end = new Date(kstDay(now));
  const year = end.getUTCFullYear() - 2,
    month = end.getUTCMonth();
  const start = new Date(
    Date.UTC(
      year,
      month,
      Math.min(
        end.getUTCDate(),
        new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
      ),
    ),
  );
  return splitWindows(start, end);
}
