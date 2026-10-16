import { describe, expect, it } from "vitest";
import { classBlockedBody, classDeletionItems, subjectDeletionItems } from "./deletion-copy";

const CLASS = {
  upcomingLessons: 0,
  pastLessons: 0,
  recordedLessons: 0,
  enrolled: 0,
  moveRequests: 0,
};

const text = (rich: (string | { strong: string })[]) =>
  rich.map((part) => (typeof part === "string" ? part : `**${part.strong}**`)).join("");

describe("classDeletionItems", () => {
  it("matches the handoff for a class that has not run", () => {
    expect(
      classDeletionItems({ ...CLASS, upcomingLessons: 16, enrolled: 6 }).map(text),
    ).toEqual([
      "No lessons have run yet, so no attendance or marks are lost.",
      "6 students come off this class. Their other classes stay.",
      "Upcoming lessons disappear from every calendar.",
    ]);
  });

  it("does not claim nothing has run when unmarked lessons have", () => {
    expect(classDeletionItems({ ...CLASS, pastLessons: 2, enrolled: 1, moveRequests: 1 }).map(text)).toEqual([
      "Its past lessons have no attendance, notes or marks, so none are lost.",
      "1 student comes off this class. Their other classes stay.",
      "1 class move request for this class is cancelled.",
    ]);
  });
});

describe("classBlockedBody", () => {
  it("names the lessons that hold the record", () => {
    expect(text(classBlockedBody(14))).toBe(
      "It has **14 lessons** with attendance, notes or marks. To keep that record safe, delete those lessons first. Once none are left, you can delete the class.",
    );
  });
});

describe("subjectDeletionItems", () => {
  it("matches the handoff's list", () => {
    expect(
      subjectDeletionItems({
        classes: 2,
        lessons: 34,
        weeks: 6,
        homework: 21,
        students: 12,
        openCredits: 0,
        hasHistory: true,
      }).map(text),
    ).toEqual([
      "**2 classes** and **34 lessons** with their attendance",
      "**6 weeks of curriculum**: videos, booklets and quizzes",
      "**21 homework tasks** and every mark on them",
      "Progress for **12 students** in this subject",
    ]);
  });

  it("lists unused make-up credits, which also go", () => {
    expect(
      subjectDeletionItems({
        classes: 0,
        lessons: 0,
        weeks: 0,
        homework: 0,
        students: 0,
        openCredits: 1,
        hasHistory: false,
      }).map(text),
    ).toEqual(["**1 unused make-up credit**"]);
  });
});
