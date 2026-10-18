import { describe, expect, it } from "vitest";
import { leaveDays } from "./leave-days";

describe("leaveDays", () => {
  it("lists every day of each period, across a month end", () => {
    expect([
      ...leaveDays([
        { startDate: "2026-10-30", endDate: "2026-11-02" },
        { startDate: "2026-12-25", endDate: "2026-12-25" },
      ]),
    ]).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-12-25"]);
  });

  it("is empty without leave", () => {
    expect(leaveDays([]).size).toBe(0);
  });
});
