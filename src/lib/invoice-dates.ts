import { melbourneDayKey } from "@/lib/format";

const dayMonthUtc = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const dayMonthYearUtc = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const weekdayUtc = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  weekday: "short",
});

/**
 * A postgres DATE (YYYY-MM-DD) as "16 Oct", or "Fri 16 Oct" with `weekday`.
 * The year is added when it is not the current Melbourne year, so an old
 * invoice never reads as this year's.
 */
export function formatInvoiceDay(
  isoDate: string,
  now: Date,
  { weekday = false }: { weekday?: boolean } = {},
): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const sameYear = String(y) === melbourneDayKey(now).slice(0, 4);
  const day = (sameYear ? dayMonthUtc : dayMonthYearUtc).format(date);
  return weekday ? `${weekdayUtc.format(date)} ${day}` : day;
}

/** An instant (e.g. issued_at) on its Melbourne calendar day, as "2 Oct". */
export function formatInvoiceInstant(at: Date, now: Date): string {
  return formatInvoiceDay(melbourneDayKey(at), now);
}
