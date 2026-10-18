import type { LeavePeriod } from "@/lib/student-leave";

/** Every date (YYYY-MM-DD) inside the leave periods, ends included. */
export function leaveDays(periods: readonly LeavePeriod[]): Set<string> {
  const days = new Set<string>();
  for (const p of periods) {
    const [y, m, d] = p.startDate.split("-").map(Number);
    const day = new Date(Date.UTC(y, m - 1, d));
    for (let iso = p.startDate; iso <= p.endDate; ) {
      days.add(iso);
      day.setUTCDate(day.getUTCDate() + 1);
      iso = day.toISOString().slice(0, 10);
    }
  }
  return days;
}
