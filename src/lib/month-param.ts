import { melbourneDate } from "@/lib/tutor-cover-rules";

/**
 * `?month=YYYY-MM` as `{ year, month }` (month 0-11). Without a valid value it
 * is the current month in Melbourne, not the server's timezone, so the first
 * hours of a month never open the previous one.
 */
export function parseMonthParam(
  value: string | undefined,
  now: Date = new Date(),
): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const [y, m] = melbourneDate(now).split("-").map(Number);
  return { year: y, month: m - 1 };
}

/**
 * A link that opens one lesson on a portal Timetable: the lesson's month with
 * the lesson selected. Every link to a family's lesson (the parent Overview,
 * cancel and reschedule notifications) uses it, so a lesson opens in one place.
 */
export function timetableLessonHref(
  timetablePath: string,
  lesson: { id: string; date: string },
  params: Record<string, string> = {},
): string {
  const query = new URLSearchParams({ ...params, month: lesson.date.slice(0, 7), lesson: lesson.id });
  return `${timetablePath}?${query.toString()}`;
}
