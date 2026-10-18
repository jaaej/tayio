import { describe, expect, it } from "vitest";
import { pendingCheckinWeeks, type CheckinWeekState } from "./pending-weeks";

const lesson = (workDate: string, endTime = "17:30:00", isRemoved = false) => ({
  workDate,
  endTime,
  isRemoved,
});

// Sunday 18 October 2026, 12:00 in Melbourne.
const NOW = new Date("2026-10-18T01:00:00Z");

describe("pendingCheckinWeeks", () => {
  it("lists finished pending weeks with lessons, oldest first", () => {
    const weeks: CheckinWeekState[] = [
      { weekStart: "2026-10-05", status: "pending", entries: [lesson("2026-10-06")] },
      { weekStart: "2026-09-07", status: "pending", entries: [lesson("2026-09-08")] },
      { weekStart: "2026-09-14", status: "approved", entries: [lesson("2026-09-15")] },
      { weekStart: "2026-09-21", status: "disputed", entries: [lesson("2026-09-22")] },
    ];
    expect(pendingCheckinWeeks(weeks, NOW)).toEqual(["2026-09-07", "2026-10-05"]);
  });

  it("leaves out a week with no lessons, or only removed ones", () => {
    expect(
      pendingCheckinWeeks(
        [
          { weekStart: "2026-09-28", status: "pending", entries: [] },
          { weekStart: "2026-10-05", status: "pending", entries: [lesson("2026-10-06", "17:30", true)] },
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it("waits until the week's last lesson has finished", () => {
    const week: CheckinWeekState = {
      weekStart: "2026-10-12",
      status: "pending",
      entries: [lesson("2026-10-13"), lesson("2026-10-18", "16:00:00")],
    };
    expect(pendingCheckinWeeks([week], NOW)).toEqual([]);
    expect(pendingCheckinWeeks([week], new Date("2026-10-18T06:00:00Z"))).toEqual(["2026-10-12"]);
  });
});
