import { isHandedIn, isHomeworkOverdue } from "@/lib/homework-rules";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";

export type OverviewHomework<T> = { item: T; dueDay: string; overdue: boolean };

/** Overdue rows the Overview lists before summing up the rest. */
export const OVERDUE_SHOWN = 3;

/**
 * The homework a parent should know about now: overdue work (the most
 * recently due first, `OVERDUE_SHOWN` of them, with how many more there
 * are), then work due by the end of this week (Monday to Sunday, in
 * Melbourne days), soonest first. `dueDay` is each item's Melbourne due day.
 */
export function homeworkNeedingAttention<T extends { status: string }>(
  rows: ReadonlyArray<T>,
  dueDayOf: (row: T) => string,
  today: string,
): { items: OverviewHomework<T>[]; moreOverdue: number } {
  const weekEnd = addIsoDays(weekStartForIsoDate(today), 7);
  const overdue: OverviewHomework<T>[] = [];
  const dueThisWeek: OverviewHomework<T>[] = [];
  for (const item of rows) {
    if (isHandedIn(item.status)) continue;
    const dueDay = dueDayOf(item);
    if (isHomeworkOverdue(item.status, dueDay, today)) overdue.push({ item, dueDay, overdue: true });
    else if (dueDay < weekEnd) dueThisWeek.push({ item, dueDay, overdue: false });
  }
  const byDay = (a: OverviewHomework<T>, b: OverviewHomework<T>) => a.dueDay.localeCompare(b.dueDay);
  overdue.sort((a, b) => byDay(b, a));
  return {
    items: [...overdue.slice(0, OVERDUE_SHOWN), ...dueThisWeek.sort(byDay)],
    moreOverdue: Math.max(0, overdue.length - OVERDUE_SHOWN),
  };
}
