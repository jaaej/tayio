import { describe, expect, it } from "vitest";
import {
  inTerm,
  issuedReportTermIds,
  latestQuizResults,
  overallMastery,
  pickTerm,
  progressTerms,
  recentMarks,
} from "./progress";

describe("overallMastery", () => {
  it("averages only subjects with tracked topics", () => {
    expect(
      overallMastery([
        { masteryPercent: 80, topics: [{ topic: "A", mastery: "strong" }] },
        { masteryPercent: 30, topics: [{ topic: "C", mastery: "needs_work" }] },
        { masteryPercent: 0, topics: [] },
      ]),
    ).toBe(55);
  });

  it("is null when nothing is tracked", () => {
    expect(overallMastery([{ masteryPercent: 0, topics: [] }])).toBeNull();
    expect(overallMastery([])).toBeNull();
  });
});

describe("progressTerms", () => {
  const rows = [
    { id: "t1", year: 2026, termNumber: 1, startDate: "2026-01-27", endDate: "2026-04-02" },
    { id: "t3", year: 2026, termNumber: 3, startDate: "2026-07-13", endDate: "2026-09-18" },
    { id: "t2", year: 2026, termNumber: 2, startDate: "2026-04-20", endDate: "2026-06-26" },
    { id: "t4", year: 2026, termNumber: 4, startDate: "2026-10-05", endDate: "2026-12-18" },
  ];

  it("offers started terms since the first enrolment, newest first", () => {
    expect(progressTerms(rows, "2026-05-01", "2026-09-01").map((t) => [t.id, t.label])).toEqual([
      ["t3", "Term 3 · 2026"],
      ["t2", "Term 2 · 2026"],
    ]);
  });

  it("offers every started term when the enrolment date is unknown", () => {
    expect(progressTerms(rows, null, "2026-10-14").map((t) => t.id)).toEqual(["t4", "t3", "t2", "t1"]);
  });

  it("covers the holidays up to the next term, and everything before the first term", () => {
    const [t3, t2] = progressTerms(rows, "2026-05-01", "2026-09-01");
    // Term 4 has not started, but it still bounds Term 3.
    expect([t3.coversFrom, t3.coversUntil]).toEqual(["2026-07-13", "2026-10-04"]);
    expect([t2.coversFrom, t2.coversUntil]).toEqual([null, "2026-07-12"]);
  });

  it("leaves the latest term open when no later term exists", () => {
    expect(progressTerms(rows, null, "2026-10-14")[0].coversUntil).toBeNull();
  });
});

describe("pickTerm", () => {
  const term = (id: string, startDate: string, endDate: string) => ({
    id,
    label: id,
    startDate,
    endDate,
    coversFrom: startDate,
    coversUntil: null,
  });
  const terms = [term("t3", "2026-07-13", "2026-09-18"), term("t2", "2026-04-20", "2026-06-26")];

  it("uses the requested term when it is on offer", () => {
    expect(pickTerm(terms, "t2", "2026-08-01")?.id).toBe("t2");
  });
  it("falls back to the term running today, then the latest", () => {
    expect(pickTerm(terms, "nope", "2026-05-01")?.id).toBe("t2");
    expect(pickTerm(terms, null, "2026-10-01")?.id).toBe("t3");
  });
  it("is null with no terms", () => {
    expect(pickTerm([], null, "2026-10-01")).toBeNull();
  });
});

describe("inTerm", () => {
  it("includes both ends of what the term covers", () => {
    const term = { coversFrom: "2026-04-20", coversUntil: "2026-07-12" };
    expect(inTerm("2026-04-20", term)).toBe(true);
    expect(inTerm("2026-07-12", term)).toBe(true);
    expect(inTerm("2026-07-13", term)).toBe(false);
    expect(inTerm("2026-04-19", term)).toBe(false);
  });
  it("is open-ended where the term has no bound", () => {
    expect(inTerm("2025-01-01", { coversFrom: null, coversUntil: "2026-07-12" })).toBe(true);
    expect(inTerm("2030-01-01", { coversFrom: "2026-04-20", coversUntil: null })).toBe(true);
  });
});

describe("issuedReportTermIds", () => {
  it("reads this student's report links once each", () => {
    expect(
      issuedReportTermIds(
        ["/reports/s1/t3", "/student/homework/x", null, "/reports/s1/t2?x=1", "/reports/s2/t9", "/reports/s1/t3"],
        "s1",
      ),
    ).toEqual(["t3", "t2"]);
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
