import { describe, expect, it } from "vitest";
import {
  classScheduleLabel,
  pauseStatusLabel,
  validateClassMove,
} from "./class-move-rules";

const valid = {
  fromClassId: "from",
  toClassId: "to",
  fromSubjectId: "subject",
  toSubjectId: "subject",
  sourceEnrolmentActive: true,
  targetEnrolmentActive: false,
  targetIsRecurring: true,
  targetHasCapacity: true,
};

describe("validateClassMove", () => {
  it("allows a different class in the same subject with capacity", () => {
    expect(validateClassMove(valid)).toBeNull();
  });

  it("rejects same-class, cross-subject, withdrawn, and full moves", () => {
    expect(validateClassMove({ ...valid, toClassId: "from" })).toMatch(/different/);
    expect(validateClassMove({ ...valid, toSubjectId: "other" })).toMatch(/same subject/);
    expect(validateClassMove({ ...valid, sourceEnrolmentActive: false })).toMatch(/no longer enrolled/);
    expect(validateClassMove({ ...valid, targetEnrolmentActive: true })).toMatch(/already enrolled/);
    expect(validateClassMove({ ...valid, targetIsRecurring: false })).toMatch(/recurring/);
    expect(validateClassMove({ ...valid, targetHasCapacity: false })).toMatch(/full/);
  });
});

describe("class move labels", () => {
  it("formats a recurring slot without exposing database time formatting", () => {
    expect(
      classScheduleLabel({ weekday: 1, startTime: "16:00:00", endTime: "17:30:00" }),
    ).toBe("Monday, 4:00pm–5:30pm");
  });

  it("keeps pause state independent and human-readable", () => {
    expect(pauseStatusLabel("none")).toBeNull();
    expect(pauseStatusLabel("on_break")).toBe("On break");
    expect(pauseStatusLabel("paused")).toBe("Paused");
  });
});
