import { describe, expect, it } from "vitest";
import { coverFit, overlaps } from "./fit";

const cover = { date: "2026-10-12", startTime: "16:00:00", endTime: "17:00:00" };
const mondayAfternoon = [
  { id: "a", weekday: 1, startTime: "15:00:00", endTime: "18:00:00" },
];

describe("overlaps", () => {
  it("treats back-to-back lessons as not overlapping", () => {
    expect(
      overlaps(cover, { date: cover.date, startTime: "17:00:00", endTime: "18:00:00" }),
    ).toBe(false);
  });

  it("detects a partial overlap on the same date only", () => {
    const slot = { startTime: "16:30:00", endTime: "17:30:00" };
    expect(overlaps(cover, { ...slot, date: cover.date })).toBe(true);
    expect(overlaps(cover, { ...slot, date: "2026-10-13" })).toBe(false);
  });
});

describe("coverFit", () => {
  it("reports a clash even when the time is inside the tutor's hours", () => {
    expect(
      coverFit(
        cover,
        [{ date: cover.date, startTime: "16:30:00", endTime: "17:30:00" }],
        mondayAfternoon,
        [],
      ),
    ).toBe("clash");
  });

  it("is free inside the weekly hours", () => {
    expect(coverFit(cover, [], mondayAfternoon, [])).toBe("free");
  });

  it("is outside the hours when the date is marked unavailable", () => {
    expect(
      coverFit(cover, [], mondayAfternoon, [
        { date: cover.date, startTime: "00:00:00", endTime: "23:59:59", isAvailable: false },
      ]),
    ).toBe("outside");
  });

  it("is outside the hours when the tutor has none that day", () => {
    expect(coverFit({ ...cover, date: "2026-10-13" }, [], mondayAfternoon, [])).toBe(
      "outside",
    );
  });
});
