/*
 * Month helpers kept at their old path for existing imports (the admin
 * student profile). The month calendar itself is the shared timetable
 * (`interactive-timetable.tsx` on `components/calendar/month-grid`).
 */

/** Re-exported for older imports; the one copy is `@/lib/month-param`. */
export { parseMonthParam } from "@/lib/month-param";

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The first day of the month and of the next one, as YYYY-MM-DD. */
export function monthBounds(
  year: number,
  month: number,
): { fromIso: string; toIso: string } {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  return { fromIso: isoLocal(from), toIso: isoLocal(to) };
}
