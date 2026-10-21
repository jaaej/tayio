/**
 * Taiyo's running week number on the check-in pages (owner decision, 23
 * October 2026): the Monday-to-Sunday week starting Monday 19 October 2026
 * is Week 200, and every week after is one more, holidays included.
 */

const WEEK_200_MONDAY = Date.UTC(2026, 9, 19);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The week number of the week holding `isoDate` (YYYY-MM-DD). */
export function checkinWeekNumber(isoDate: string): number {
  return 200 + Math.floor((Date.parse(`${isoDate}T00:00:00Z`) - WEEK_200_MONDAY) / WEEK_MS);
}

/** "Week 200" for the week holding `isoDate`. */
export function checkinWeekLabel(isoDate: string): string {
  return `Week ${checkinWeekNumber(isoDate)}`;
}
