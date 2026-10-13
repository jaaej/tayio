import { describe, expect, it } from "vitest";
import {
  focusTopic,
  homeworkCounts,
  latestQuizResults,
  overallSummary,
  recentMarks,
} from "./progress";

describe("overallSummary", () => {
  it("averages only subjects with tracked topics and counts topic levels", () => {
    const summary = overallSummary([
      {
        masteryPercent: 80,
        topics: [
          { topic: "A", mastery: "strong" },
          { topic: "B", mastery: "improving" },
        ],
      },
      {
        masteryPercent: 30,
        topics: [
          { topic: "C", mastery: "needs_work" },
          { topic: "D", mastery: "not_started" },
        ],
      },
      { masteryPercent: 0, topics: [] },
    ]);
    expect(summary).toEqual({ percent: 55, topics: 4, strong: 1, improving: 1, focus: 2 });
  });

  it("is null when nothing is tracked", () => {
    expect(overallSummary([{ masteryPercent: 0, topics: [] }]).percent).toBeNull();
    expect(overallSummary([]).percent).toBeNull();
  });
});

describe("focusTopic", () => {
  it("prefers a topic that needs work over one not started", () => {
    expect(
      focusTopic([
        { topic: "Angles", mastery: "not_started" },
        { topic: "Elimination", mastery: "needs_work" },
      ]),
    ).toBe("Elimination");
  });

  it("is null when every topic is going well", () => {
    expect(focusTopic([{ topic: "A", mastery: "strong" }])).toBeNull();
  });
});

describe("homeworkCounts", () => {
  it("splits handed-in work from work still to do", () => {
    expect(
      homeworkCounts([
        { status: "submitted" },
        { status: "late" },
        { status: "marked" },
        { status: "returned" },
        { status: "not_started" },
        { status: "viewed" },
        { status: "resubmission_requested" },
      ]),
    ).toEqual({ submitted: 4, pending: 3 });
  });
});

describe("latestQuizResults", () => {
  it("keeps the latest attempt per quiz with its try count, newest first", () => {
    const rows = [
      { quizId: "q1", title: "Q1", correctCount: 5, total: 10, submittedAt: new Date("2026-09-01") },
      { quizId: "q1", title: "Q1", correctCount: 9, total: 10, submittedAt: new Date("2026-09-03") },
      { quizId: "q2", title: "Q2", correctCount: 4, total: 5, submittedAt: new Date("2026-09-05") },
    ];
    expect(latestQuizResults(rows)).toEqual([
      { ...rows[2], tries: 1 },
      { ...rows[1], tries: 2 },
    ]);
  });
});

describe("recentMarks", () => {
  const base = {
    feedback: null,
    isTest: false,
    dueDate: new Date("2026-09-01"),
  };

  it("merges marked homework and quizzes newest first and skips unmarked work", () => {
    const marks = recentMarks(
      [
        { ...base, homeworkId: "h1", title: "Worksheet", status: "marked", score: "91.50", markedAt: new Date("2026-09-10") },
        { ...base, homeworkId: "h2", title: "Draft", status: "submitted", score: null, markedAt: null },
        { ...base, homeworkId: "h3", title: "Old test", status: "returned", score: "70", markedAt: null, isTest: true, feedback: "  " },
      ],
      [
        { quizId: "q1", title: "Quiz", correctCount: 8, total: 10, submittedAt: new Date("2026-09-12"), tries: 2 },
        { quizId: "q2", title: "Empty", correctCount: 0, total: 0, submittedAt: new Date("2026-09-13"), tries: 1 },
      ],
    );
    expect(marks.map((m) => m.id)).toEqual(["q1", "h1", "h3"]);
    expect(marks[1]).toMatchObject({ kind: "homework", percent: 91.5 });
    // Falls back to the due date for ordering, keeps no blank feedback.
    expect(marks[2]).toMatchObject({ isTest: true, feedback: null, at: null });
  });

  it("caps the list", () => {
    const quizzes = Array.from({ length: 8 }, (_, i) => ({
      quizId: `q${i}`,
      title: `Quiz ${i}`,
      correctCount: 1,
      total: 2,
      submittedAt: new Date(2026, 8, i + 1),
      tries: 1,
    }));
    expect(recentMarks([], quizzes)).toHaveLength(5);
    expect(recentMarks([], quizzes, 3).map((m) => m.id)).toEqual(["q7", "q6", "q5"]);
  });
});
