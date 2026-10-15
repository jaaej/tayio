import { describe, expect, it } from "vitest";
import { attendanceSummary, homeworkState, withListQuery } from "./student-list";

describe("attendanceSummary", () => {
  it("counts late, left early and make-ups as attended", () => {
    expect(
      attendanceSummary(["present", "late", "left_early", "makeup_attended", "absent"]),
    ).toEqual({ attended: 4, total: 5, percent: 80 });
  });

  it("has no percentage before any lesson is marked", () => {
    expect(attendanceSummary([])).toEqual({ attended: 0, total: 0, percent: null });
  });
});

describe("homeworkState", () => {
  const today = "2026-10-12";
  it("treats submitted and late as waiting for marking", () => {
    expect(homeworkState("submitted", "2026-10-01", today)).toBe("to_mark");
    expect(homeworkState("late", "2026-10-01", today)).toBe("to_mark");
  });
  it("marks returned work as marked", () => {
    expect(homeworkState("returned", "2026-10-01", today)).toBe("marked");
  });
  it("splits work not handed in by its due date", () => {
    expect(homeworkState("not_started", "2026-10-11", today)).toBe("overdue");
    expect(homeworkState("viewed", "2026-10-12", today)).toBe("due_today");
    expect(homeworkState("resubmission_requested", "2026-10-13", today)).toBe("open");
  });
});

describe("withListQuery", () => {
  it("carries the class the profile was opened from and adds extras", () => {
    const sp = new URLSearchParams("class=c1&tab=homework&q=old");
    expect(withListQuery("/tutor/students/a", sp)).toBe("/tutor/students/a?class=c1");
    expect(withListQuery("/tutor/students/a", { class: "c1" }, { tab: "notes" })).toBe(
      "/tutor/students/a?class=c1&tab=notes",
    );
    expect(withListQuery("/tutor/students/a", {}, { tab: "notes" })).toBe(
      "/tutor/students/a?tab=notes",
    );
  });
});
