/** Calendar qualifications are valid through their declared date in Korea. */
export const koreanCalendarDate = (now: Date): string =>
  new Date(now.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 10);
