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

interface CoverageWindow {
  periodStart: string;
  periodEnd: string;
  status: string;
}
/** Follow connected completed intervals from the earliest durable requested
 * date. MAX(periodEnd) would incorrectly jump over a gap or unfinished month. */
export function awardCoverageThrough(runs: CoverageWindow[]): string | null {
  if (!runs.length) return null;
  const ordered = [...runs].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart),
  );
  const anchor = new Date(ordered[0].periodStart).getTime();
  let through = anchor - 86400000;
  for (const run of ordered) {
    if (run.status !== "SUCCEEDED") continue;
    const start = new Date(run.periodStart).getTime(),
      end = new Date(run.periodEnd).getTime();
    if (start > through + 86400000) break;
    through = Math.max(through, end);
  }
  return through < anchor ? null : day(new Date(through));
}
export function planIncrementalAwardWindows(
  now: Date,
  runs: CoverageWindow[],
): AwardWindow[] {
  const end = new Date(kstDay(now));
  if (!runs.length)
    return splitWindows(new Date(end.getTime() - 6 * 86400000), end);
  const anchor = runs.map((run) => run.periodStart).sort()[0];
  const through = awardCoverageThrough(runs);
  if (through && through >= kstDay(now)) return [];
  const start = through
    ? new Date(
        Math.max(
          new Date(anchor).getTime(),
          new Date(through).getTime() - 6 * 86400000,
        ),
      )
    : new Date(anchor);
  return splitWindows(start, end);
}
