import { describe, expect, it } from "vitest";
import { lessonTimeline, withListQuery } from "./student-list";

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

describe("lessonTimeline", () => {
  const lesson = (lessonId: string, lessonDate: string, lessonTutorId = "me") => ({
    lessonId,
    lessonDate,
    className: "Year 9 Maths",
    lessonTutorId,
  });

  it("puts each lesson's mark and notes together, newest first", () => {
    const timeline = lessonTimeline(
      [
        { ...lesson("l1", "2026-10-05"), status: "present", moved: false, note: "Arrived late" },
        { ...lesson("l2", "2026-10-12"), status: "absent", moved: true, note: null },
      ],
      [
        { ...lesson("l1", "2026-10-05"), authorId: "me", note: "mine" },
        { ...lesson("l3", "2026-10-19", "other"), authorId: "other", note: "theirs" },
      ],
      "me",
    );
    expect(timeline.map((e) => e.lessonId)).toEqual(["l3", "l2", "l1"]);
    expect(timeline[2]).toMatchObject({
      mark: { status: "present", moved: false, note: "Arrived late" },
      notes: ["mine"],
      canEdit: true,
      hasOwnNote: true,
    });
    expect(timeline[1]).toMatchObject({ notes: [], hasOwnNote: false, canEdit: true });
    expect(timeline[0]).toMatchObject({ mark: null, notes: ["theirs"], canEdit: false, hasOwnNote: false });
  });

  it("is empty for a student with no lessons yet", () => {
    expect(lessonTimeline([], [], "me")).toEqual([]);
  });
});
