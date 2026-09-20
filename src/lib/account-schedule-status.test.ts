import { describe, expect, it } from "vitest";
import {
  accountScheduleStatusLabel,
  chooseAccountSchedulePeriod,
  freeTrialDirectoryState,
  type AccountSchedulePeriod,
} from "./account-schedule-status";

const periods: AccountSchedulePeriod[] = [
  {
    kind: "student_break",
    approval: "approved",
    startDate: "2026-09-18",
    endDate: "2026-09-22",
  },
  {
    kind: "student_break",
    approval: "approved",
    startDate: "2026-10-01",
    endDate: "2026-10-07",
  },
];

describe("account schedule status", () => {
  it("prefers a current dated break over a future one", () => {
    const selected = chooseAccountSchedulePeriod(
      "student",
      "2026-09-19",
      periods,
    );
    expect(selected?.startDate).toBe("2026-09-18");
    expect(accountScheduleStatusLabel(selected!, "2026-09-19")).toBe(
      "On break",
    );
  });

  it("distinguishes pending and approved tutor leave", () => {
    const pending: AccountSchedulePeriod = {
      kind: "tutor_leave",
      approval: "pending",
      startDate: "2026-10-01",
      endDate: "2026-10-14",
    };
    expect(accountScheduleStatusLabel(pending, "2026-09-19")).toBe(
      "Leave pending",
    );
    expect(
      accountScheduleStatusLabel(
        { ...pending, approval: "approved" },
        "2026-09-19",
      ),
    ).toBe("Leave approved");
  });

  it("does not surface an expired period", () => {
    expect(
      chooseAccountSchedulePeriod("student", "2026-09-23", [periods[0]]),
    ).toBeNull();
  });
});

describe("free trial directory state", () => {
  const trial = { startDate: "2026-09-18", endDate: "2026-09-22" };

  it("labels scheduled, current and ended windows", () => {
    expect(freeTrialDirectoryState(trial, "2026-09-17")).toBe("scheduled");
    expect(freeTrialDirectoryState(trial, "2026-09-19")).toBe("current");
    expect(freeTrialDirectoryState(trial, "2026-09-23")).toBe("ended");
  });
});
