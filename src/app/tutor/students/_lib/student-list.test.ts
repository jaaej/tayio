import { describe, expect, it } from "vitest";
import { lessonTimeline, profileBack, withListQuery } from "./student-list";

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

describe("profileBack", () => {
  const S = "11111111-1111-4111-8111-111111111111";
  const ID = "22222222-2222-4222-8222-222222222222";

  it("returns to the class roster, the submission, the lesson or Today", () => {
    expect(profileBack(S, { class: ID })).toEqual({ href: `/tutor/classes/${ID}/students`, label: "Back to class" });
    expect(profileBack(S, { from: "marking", homework: ID })).toEqual({
      href: `/tutor/homework/${ID}?student=${S}`,
      label: "Back to marking",
    });
    expect(profileBack(S, new URLSearchParams(`from=marking&homework=${ID}&view=marked`)).href).toBe(
      `/tutor/homework/${ID}?student=${S}&view=marked`,
    );
    expect(profileBack(S, { from: "lesson", lesson: ID })).toEqual({ href: `/tutor/lessons/${ID}`, label: "Back to lesson" });
    expect(profileBack(S, { from: "today" })).toEqual({ href: "/tutor", label: "Back to Today" });
  });

  it("falls back to Classes for anything else or a malformed id", () => {
    const classes = { href: "/tutor/classes", label: "Classes" };
    expect(profileBack(S, {})).toEqual(classes);
    expect(profileBack(S, { from: "marking", homework: "../admin" })).toEqual(classes);
    expect(profileBack(S, { from: "elsewhere" })).toEqual(classes);
  });

  it("keeps the origin on tab links", () => {
    expect(withListQuery(`/tutor/students/${S}`, { from: "marking", homework: ID }, { tab: "homework" })).toBe(
      `/tutor/students/${S}?from=marking&homework=${ID}&tab=homework`,
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
