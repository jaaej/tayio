import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";

// Week navigation for the dashboard "This week" calendars (admin dashboard and
// tutor Today): one `?week=` contract and one header label for both.

/** The Monday of `?week=`, or of `todayIso` when the param is missing or bad. */
export function weekStartFromParam(
  param: string | undefined,
  todayIso: string,
): string {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    try {
      return weekStartForIsoDate(param);
    } catch {
      /* invalid date: fall through to this week */
    }
  }
  return weekStartForIsoDate(todayIso);
}

const DAY = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: "UTC" });
const DAY_MONTH = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "12 – 18 Oct", or "29 Sept – 5 Oct" across a month boundary. */
export function weekSpanLabel(weekStart: string): string {
  const end = addIsoDays(weekStart, 6);
  const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  return `${(sameMonth ? DAY : DAY_MONTH).format(at(weekStart))} – ${DAY_MONTH.format(at(end))}`;
}
