import { describe, expect, it } from "vitest";
import {
  addIsoDays,
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
