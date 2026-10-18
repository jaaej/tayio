import { lessonStartInstant } from "@/lib/tutor-cover-rules";
import type { TimetableChip } from "./interactive-timetable";

type ChipTiming = Pick<TimetableChip, "id" | "date" | "startTime">;

/** Lesson dates and times are Melbourne wall-clock values. */
function startsAt(chip: Pick<TimetableChip, "date" | "startTime">) {
  return lessonStartInstant(chip.date, chip.startTime).getTime();
}

export type AttendanceChip = Pick<
  TimetableChip,
  "status" | "studentState" | "cancelled" | "convertedToCredit"
>;

/**
 * Whether the student is on this lesson: one source for "next lesson" on the
 * timetable, the student dashboard and the parent Overview. A lesson they
 * moved away from, cancelled for a credit or turned into a credit is not
 * theirs any more, nor is a lesson the office cancelled or rescheduled; a
 * make-up they were booked into is. A move still waiting for approval keeps
 * them on the original lesson, and its requested slot is not a lesson yet.
 */
export function isAttendingLesson(chip: AttendanceChip): boolean {
  return (
    chip.status !== "cancelled" &&
    chip.status !== "rescheduled" &&
    chip.studentState !== "moved_out" &&
    chip.studentState !== "pending_in" &&
    !chip.cancelled &&
    !chip.convertedToCredit
  );
}

function byStart(a: ChipTiming, b: ChipTiming) {
  return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
}

/**
 * The student's next lesson: the soonest one they are on (`isAttendingLesson`)
 * that has not started yet. Null when nothing is coming up in the window.
 */
export function nextAttendingLesson<T extends ChipTiming & AttendanceChip>(
  chips: readonly T[],
  now: Date,
): T | null {
  return (
    chips
      .filter((c) => isAttendingLesson(c) && startsAt(c) > now.getTime())
      .sort(byStart)[0] ?? null
  );
}

/**
 * The lesson the timetable opens with in its "Selected lesson" card: the
 * student's next lesson (`nextAttendingLesson`).
 */
export function defaultSelectedLessonId(
  chips: Array<ChipTiming & AttendanceChip>,
  now: Date,
): string | null {
  return nextAttendingLesson(chips, now)?.id ?? null;
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
