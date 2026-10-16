import { describe, expect, it } from "vitest";
import { classDeletionItems, subjectDeletionItems } from "./deletion-copy";

const EMPTY_CLASS = {
  upcomingLessons: 0,
  enrolled: 0,
  pastLessons: 0,
  attendanceRecords: 0,
  lessonNotes: 0,
  announcements: 0,
  moveRequests: 0,
  hasHistory: false,
};

describe("classDeletionItems", () => {
  it("lists only what exists, with counts", () => {
    expect(
      classDeletionItems({ ...EMPTY_CLASS, upcomingLessons: 16, enrolled: 1 }),
    ).toEqual(["16 upcoming lessons", "1 student's place in the class"]);
  });

  it("lists history first", () => {
    expect(
      classDeletionItems({
        ...EMPTY_CLASS,
        upcomingLessons: 3,
        pastLessons: 5,
        attendanceRecords: 12,
        lessonNotes: 1,
        announcements: 2,
        moveRequests: 1,
        hasHistory: true,
      }),
    ).toEqual([
      "5 past lessons",
      "12 attendance records",
      "1 lesson note",
      "2 class announcements",
      "3 upcoming lessons",
      "1 class move request",
    ]);
  });

  it("is empty for a bare class", () => {
    expect(classDeletionItems(EMPTY_CLASS)).toEqual([]);
  });
});

describe("subjectDeletionItems", () => {
  it("lists the curriculum that goes with the subject", () => {
    expect(
      subjectDeletionItems({
        classes: [],
        weeks: 10,
        topics: 1,
        quizzes: 2,
        quizAttempts: 14,
        resources: 0,
        discussionThreads: 3,
        openCredits: 1,
        hasContent: true,
      }),
    ).toEqual([
      "10 curriculum weeks",
      "1 topic",
      "2 quizzes and 14 student attempts",
      "3 discussion threads",
      "1 unused make-up credit",
    ]);
  });
});
