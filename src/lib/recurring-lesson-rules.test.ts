import { describe, expect, it } from "vitest";
import {
  addIsoDays,
  classTimeRangeError,
  RECURRING_LESSON_HORIZON_DAYS,
  weeklyDatesInRange,
} from "./recurring-lesson-rules";

describe("recurring lesson calendar rules", () => {
  it("builds every matching weekday through an inclusive horizon", () => {
    expect(
      weeklyDatesInRange({
        fromIso: "2026-09-20",
        throughIso: "2026-10-08",
        weekday: 4,
      }),
    ).toEqual(["2026-09-24", "2026-10-01", "2026-10-08"]);
  });

  it("includes today when today is the recurring weekday", () => {
    expect(
      weeklyDatesInRange({
        fromIso: "2026-09-24",
        throughIso: "2026-10-01",
        weekday: 4,
      }),
    ).toEqual(["2026-09-24", "2026-10-01"]);
  });

  it("uses a sixteen-week rolling horizon", () => {
    expect(addIsoDays("2026-09-20", RECURRING_LESSON_HORIZON_DAYS)).toBe(
      "2027-01-10",
    );
  });
});

describe("class time range rule", () => {
  it("accepts a finish after the start, with or without seconds", () => {
    expect(classTimeRangeError("12:00", "14:10")).toBeNull();
    expect(classTimeRangeError("12:00:00", "14:10:00")).toBeNull();
  });

  it("rejects a finish that is not after the start", () => {
    // 02:10 is 2:10 AM - the AM/PM slip that broke tutor check-ins.
    expect(classTimeRangeError("12:00", "02:10")).toMatch(/after the start/);
    expect(classTimeRangeError("16:00", "16:00")).toMatch(/after the start/);
  });

  it("leaves an unscheduled class alone", () => {
    expect(classTimeRangeError(null, null)).toBeNull();
    expect(classTimeRangeError("12:00", null)).toBeNull();
  });
});
