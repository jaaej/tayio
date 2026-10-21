import { describe, expect, it } from "vitest";
import { checkinWeekLabel, checkinWeekNumber } from "./checkin-week";

describe("checkinWeekNumber", () => {
  it("is Week 200 from Monday 19 to Sunday 25 October 2026", () => {
    expect(checkinWeekNumber("2026-10-19")).toBe(200);
    expect(checkinWeekNumber("2026-10-25")).toBe(200);
  });

  it("goes up one a week, through the holidays and the new year", () => {
    expect(checkinWeekNumber("2026-10-26")).toBe(201);
    expect(checkinWeekNumber("2026-12-28")).toBe(210);
    expect(checkinWeekNumber("2027-01-04")).toBe(211);
  });

  it("counts back before Week 200", () => {
    expect(checkinWeekNumber("2026-10-18")).toBe(199);
    expect(checkinWeekNumber("2026-10-12")).toBe(199);
  });

  it("reads as Week 200", () => {
    expect(checkinWeekLabel("2026-10-19")).toBe("Week 200");
  });
});
