import { describe, expect, it } from "vitest";
import { attendanceLabel, attendanceSummary, isMovedAbsence } from "./attendance-rules";

describe("attendanceSummary", () => {
  it("counts late, left early and make-ups as attended", () => {
    expect(
      attendanceSummary(["present", "late", "left_early", "makeup_attended", "absent"].map((status) => ({ status }))),
    ).toEqual({ attended: 4, absent: 1, total: 5, percent: 80 });
  });

  it("leaves moved lessons out of the rate", () => {
    // Moved Tuesday's lesson, went to the make-up: 100%, not 50%.
    expect(
      attendanceSummary([
        { status: "absent", moved: true },
        { status: "makeup_attended" },
      ]),
    ).toEqual({ attended: 1, absent: 0, total: 1, percent: 100 });
  });

  it("has no percentage before any lesson counts", () => {
    expect(attendanceSummary([])).toEqual({ attended: 0, absent: 0, total: 0, percent: null });
    expect(attendanceSummary([{ status: "absent", moved: true }]).percent).toBeNull();
  });
});

describe("attendanceLabel", () => {
  it("reads a moved absence as Moved and a real one as Absent", () => {
    expect(attendanceLabel({ status: "absent", moved: true })).toBe("Moved");
    expect(attendanceLabel({ status: "absent", moved: false })).toBe("Absent");
    expect(attendanceLabel({ status: "left_early" })).toBe("Left early");
  });

  it("never treats a moved flag on an attended mark as a move", () => {
    expect(isMovedAbsence({ status: "present", moved: true })).toBe(false);
  });
});
