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
