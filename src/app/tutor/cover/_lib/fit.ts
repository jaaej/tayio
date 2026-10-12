import {
  availableWindowsOnDate,
  coversTime,
  timeToMinutes,
  type DateAvailabilityRow,
  type WeeklyAvailabilityRow,
} from "@/lib/availability-windows";

/*
 * How an open cover request fits the viewing tutor's week. A clash wins over
 * availability because the claim itself is refused when the tutor already
 * teaches at that time (see assignCover in app/_actions/tutor-cover.ts).
 */

export type CoverFit = "clash" | "free" | "outside";

type Slot = { date: string; startTime: string; endTime: string };

export function overlaps(a: Slot, b: Slot): boolean {
  return (
    a.date === b.date &&
    timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
    timeToMinutes(b.startTime) < timeToMinutes(a.endTime)
  );
}

export function coverFit(
  cover: Slot,
  ownLessons: readonly Slot[],
  weekly: readonly WeeklyAvailabilityRow[],
  dateRows: readonly DateAvailabilityRow[],
): CoverFit {
  if (ownLessons.some((lesson) => overlaps(cover, lesson))) return "clash";
  const windows = availableWindowsOnDate(weekly, dateRows, cover.date);
  return coversTime(windows, cover.startTime, cover.endTime) ? "free" : "outside";
}
