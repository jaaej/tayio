import { describe, expect, it } from "vitest";
import {
  addIsoDays,
  checkinApprovalTimingError,
  checkinMinutes,
  checkinPay,
  checkinReminderDay,
  weekStartForIsoDate,
} from "./tutor-checkin-rules";

describe("tutor check-in rules", () => {
  it("normalises every day to its Monday", () => {
    expect(weekStartForIsoDate("2026-09-13")).toBe("2026-09-07");
    expect(weekStartForIsoDate("2026-09-07")).toBe("2026-09-07");
  });

  it("adds days across month boundaries", () => {
    expect(addIsoDays("2026-09-28", 7)).toBe("2026-10-05");
  });

  it("calculates duration and rejects backwards times", () => {
    expect(checkinMinutes("16:00:00", "17:30:00")).toBe(90);
    expect(() => checkinMinutes("17:30", "16:00")).toThrow();
  });

  it("rounds pay to cents", () => {
    expect(checkinPay(90, "35.00")).toBe(52.5);
    expect(checkinPay(20, "37.50")).toBe(12.5);
    expect(() => checkinPay(-1, "35.00")).toThrow();
    expect(() => checkinPay(60, Number.NaN)).toThrow();
  });

  it("does not approve a week until every paid lesson has finished", () => {
    const entries = [
      { workDate: "2026-09-20", endTime: "17:00:00", isRemoved: false },
      { workDate: "2026-09-20", endTime: "20:00:00", isRemoved: true },
    ];
    expect(
      checkinApprovalTimingError(entries, new Date("2026-09-20T06:00:00Z")),
    ).toContain("has finished");
    expect(
      checkinApprovalTimingError(entries, new Date("2026-09-20T08:00:00Z")),
    ).toBeNull();
  });

  it("runs reminders on Saturday and Sunday only", () => {
    expect(checkinReminderDay("2026-09-18")).toBeNull();
    expect(checkinReminderDay("2026-09-19")).toBe("saturday");
    expect(checkinReminderDay("2026-09-20")).toBe("sunday");
    expect(checkinReminderDay("2026-09-21")).toBeNull();
  });
});
