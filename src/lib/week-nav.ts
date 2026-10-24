import { weekStartForIsoDate } from "@/lib/tutor-checkin-rules";

// Week navigation for the dashboard "This week" calendars (admin dashboard and
// tutor Today): one `?week=` contract for both.

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
