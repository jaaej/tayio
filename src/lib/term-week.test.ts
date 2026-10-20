import { describe, expect, it } from "vitest";
import { weekOfTermLabel } from "./term-week";

const TERM_4 = { termNumber: 4, startDate: "2026-10-12", endDate: "2026-11-22" };
const TERM_3 = { termNumber: 3, startDate: "2026-07-13", endDate: "2026-09-18" };

describe("weekOfTermLabel", () => {
  it("numbers the weeks from the term's start", () => {
    expect(weekOfTermLabel([TERM_4], "2026-10-12")).toBe("Term 4, Week 1");
    expect(weekOfTermLabel([TERM_4], "2026-10-19")).toBe("Term 4, Week 2");
    expect(weekOfTermLabel([TERM_4], "2026-11-16")).toBe("Term 4, Week 6");
  });

  it("makes the week a mid-week term starts in Week 1", () => {
    const wednesdayStart = { termNumber: 1, startDate: "2026-01-28", endDate: "2026-04-02" };
    expect(weekOfTermLabel([wednesdayStart], "2026-01-26")).toBe("Term 1, Week 1");
  });

  it("counts a week the term ends in as part of the term", () => {
    expect(weekOfTermLabel([TERM_3], "2026-09-14")).toBe("Term 3, Week 10");
  });

  it("calls a week with no term day the holidays", () => {
    expect(weekOfTermLabel([TERM_3, TERM_4], "2026-09-28")).toBe("Holidays");
    expect(weekOfTermLabel([TERM_4], "2026-11-23")).toBe("Holidays");
  });

  it("picks the term the week is in", () => {
    expect(weekOfTermLabel([TERM_4, TERM_3], "2026-07-20")).toBe("Term 3, Week 2");
  });

  it("says nothing when no terms are set", () => {
    expect(weekOfTermLabel([], "2026-10-19")).toBeNull();
  });
});
