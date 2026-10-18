import { describe, expect, it } from "vitest";
import {
  defaultSelectedLessonId,
  isAttendingLesson,
  nextAttendingLesson,
  termAllowanceLabel,
} from "./timetable-helpers";

// Tue 13 Oct 2026, noon in Melbourne (AEDT, UTC+11); lesson times are
// Melbourne wall-clock times whatever the server's timezone.
const NOW = new Date("2026-10-13T12:00:00+11:00");

function chip(over: Partial<Parameters<typeof defaultSelectedLessonId>[0][number] & {
  rescheduleRemaining: number | null;
  cancelRemaining: number | null;
}>) {
  return {
    id: "x",
    date: "2026-10-15",
    startTime: "16:00:00",
    status: "upcoming",
    studentState: "normal" as const,
    cancelled: false,
    convertedToCredit: false,
    rescheduleRemaining: 2,
    cancelRemaining: 1,
    ...over,
  };
}

describe("defaultSelectedLessonId", () => {
  it("picks the soonest lesson that has not started", () => {
    expect(
      defaultSelectedLessonId(
        [
          chip({ id: "later", date: "2026-10-20" }),
          chip({ id: "past", date: "2026-10-13", startTime: "09:00:00" }),
          chip({ id: "soon", date: "2026-10-13", startTime: "16:00:00" }),
        ],
        NOW,
      ),
    ).toBe("soon");
  });

  it("skips cancelled, credited and non-upcoming lessons", () => {
    expect(
      defaultSelectedLessonId(
        [
          chip({ id: "a", cancelled: true }),
          chip({ id: "b", convertedToCredit: true }),
          chip({ id: "c", status: "cancelled" }),
          chip({ id: "d", date: "2026-10-22" }),
        ],
        NOW,
      ),
    ).toBe("d");
  });

  it("returns null when nothing is coming up", () => {
    expect(defaultSelectedLessonId([chip({ date: "2026-10-01" })], NOW)).toBeNull();
    expect(defaultSelectedLessonId([], NOW)).toBeNull();
  });
});

describe("nextAttendingLesson", () => {
  it("skips a lesson the student moved away from and takes their make-up", () => {
    const next = nextAttendingLesson(
      [
        chip({ id: "moved", date: "2026-10-14", studentState: "moved_out" }),
        chip({ id: "requested-slot", date: "2026-10-14", startTime: "17:00:00", studentState: "pending_in" }),
        chip({ id: "makeup", date: "2026-10-15", studentState: "makeup_in" }),
        chip({ id: "regular", date: "2026-10-16" }),
      ],
      NOW,
    );
    expect(next?.id).toBe("makeup");
  });

  it("keeps the original lesson while a move waits for approval", () => {
    expect(isAttendingLesson(chip({ studentState: "pending_out" }))).toBe(true);
    expect(isAttendingLesson(chip({ status: "rescheduled" }))).toBe(false);
  });

  it("reads lesson times as Melbourne time", () => {
    // 1 pm Melbourne is after noon Melbourne, whatever the server's zone.
    expect(nextAttendingLesson([chip({ id: "one", date: "2026-10-13", startTime: "13:00:00" })], NOW)?.id).toBe("one");
    expect(nextAttendingLesson([chip({ id: "eleven", date: "2026-10-13", startTime: "11:00:00" })], NOW)).toBeNull();
  });
});

describe("termAllowanceLabel", () => {
  it("reads the soonest upcoming lesson with resolved counts", () => {
    expect(
      termAllowanceLabel(
        [
          chip({ id: "no-term", date: "2026-10-14", rescheduleRemaining: null, cancelRemaining: null }),
          chip({ id: "next", date: "2026-10-15", rescheduleRemaining: 2, cancelRemaining: 1 }),
          chip({ id: "later", date: "2026-10-22", rescheduleRemaining: 3, cancelRemaining: 3 }),
        ],
        NOW,
      ),
    ).toBe("2 reschedules and 1 cancellation left this term");
  });

  it("uses singular and plural forms", () => {
    expect(termAllowanceLabel([chip({ rescheduleRemaining: 1, cancelRemaining: 0 })], NOW)).toBe(
      "1 reschedule and 0 cancellations left this term",
    );
  });

  it("ignores past lessons and returns null without counts", () => {
    expect(termAllowanceLabel([chip({ date: "2026-10-01" })], NOW)).toBeNull();
    expect(
      termAllowanceLabel([chip({ rescheduleRemaining: null, cancelRemaining: null })], NOW),
    ).toBeNull();
  });
});
