import { describe, expect, it } from "vitest";
import { defaultSelectedLessonId, termAllowanceLabel } from "./timetable-helpers";

const NOW = new Date("2026-10-13T12:00:00");

function chip(over: Partial<Parameters<typeof defaultSelectedLessonId>[0][number] & {
  rescheduleRemaining: number | null;
  cancelRemaining: number | null;
}>) {
  return {
    id: "x",
    date: "2026-10-15",
    startTime: "16:00:00",
    status: "upcoming",
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
