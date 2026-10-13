import type { TimetableChip } from "./interactive-timetable";

type ChipTiming = Pick<TimetableChip, "id" | "date" | "startTime">;

function startsAt(chip: Pick<TimetableChip, "date" | "startTime">) {
  return new Date(`${chip.date}T${chip.startTime}`).getTime();
}

function byStart(a: ChipTiming, b: ChipTiming) {
  return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
}

/**
 * The lesson the timetable opens with in its "Selected lesson" card: the next
 * lesson that has not started and is still on (not cancelled or converted to a
 * credit). Null when nothing is coming up in the loaded window.
 */
export function defaultSelectedLessonId(
  chips: Pick<
    TimetableChip,
    "id" | "date" | "startTime" | "status" | "cancelled" | "convertedToCredit"
  >[],
  now: Date,
): string | null {
  const next = chips
    .filter(
      (c) =>
        c.status === "upcoming" &&
        !c.cancelled &&
        !c.convertedToCredit &&
        startsAt(c) > now.getTime(),
    )
    .sort(byStart)[0];
  return next?.id ?? null;
}

/**
 * The page header's allowance line, e.g. "2 reschedules and 1 cancellation
 * left this term". Read from the soonest upcoming lesson whose term resolved,
 * because buildTimetableChips only fills the remaining counts for lessons in a
 * known term. Null when no upcoming lesson carries the counts.
 */
export function termAllowanceLabel(
  chips: Pick<
    TimetableChip,
    "id" | "date" | "startTime" | "rescheduleRemaining" | "cancelRemaining"
  >[],
  now: Date,
): string | null {
  const chip = chips
    .filter(
      (c) =>
        c.rescheduleRemaining !== null &&
        c.cancelRemaining !== null &&
        startsAt(c) > now.getTime(),
    )
    .sort(byStart)[0];
  if (!chip) return null;
  const r = chip.rescheduleRemaining!;
  const c = chip.cancelRemaining!;
  return `${r} ${r === 1 ? "reschedule" : "reschedules"} and ${c} ${
    c === 1 ? "cancellation" : "cancellations"
  } left this term`;
}
