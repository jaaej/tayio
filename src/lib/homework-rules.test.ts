import { describe, expect, it } from "vitest";
import { canSubmitHomework, homeworkState, isHandedIn, isHomeworkOverdue } from "./homework-rules";

const today = "2026-10-12";

describe("isHandedIn", () => {
  it("counts a late hand-in as handed in", () => {
    expect(isHandedIn("late")).toBe(true);
    expect(isHandedIn("returned")).toBe(true);
    expect(isHandedIn("resubmission_requested")).toBe(false);
  });
});

describe("isHomeworkOverdue", () => {
  it("is overdue only when not handed in after the due date", () => {
    expect(isHomeworkOverdue("not_started", "2026-10-11", today)).toBe(true);
    expect(isHomeworkOverdue("late", "2026-10-01", today)).toBe(false);
    expect(isHomeworkOverdue("viewed", today, today)).toBe(false);
    expect(isHomeworkOverdue("resubmission_requested", "2026-10-01", today)).toBe(true);
  });
});

describe("homeworkState", () => {
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

describe("canSubmitHomework", () => {
  it("lets a student hand in until the work is marked", () => {
    expect(canSubmitHomework("not_started", false)).toBe(true);
    expect(canSubmitHomework("viewed", false)).toBe(true);
    expect(canSubmitHomework("resubmission_requested", false)).toBe(true);
    expect(canSubmitHomework("submitted", false)).toBe(false);
    expect(canSubmitHomework("late", false)).toBe(false);
    expect(canSubmitHomework("submitted", true)).toBe(true);
    expect(canSubmitHomework("late", true)).toBe(true);
    expect(canSubmitHomework("marked", true)).toBe(false);
    expect(canSubmitHomework("returned", true)).toBe(false);
  });
});
