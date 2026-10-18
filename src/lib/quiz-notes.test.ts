import { describe, expect, it } from "vitest";
import { quizNotes } from "./quiz-notes";

describe("quizNotes", () => {
  it("keeps the brief and the change request as two notes", () => {
    const notes = quizNotes({
      status: "changes_requested",
      note: "Cover chapter 3",
      reviewNote: "Question 2 has two right answers",
      // 18 Oct 2026, 9am in Melbourne.
      reviewNoteAt: new Date("2026-10-17T22:00:00Z"),
    });
    expect(notes.map((n) => [n.label, n.text, n.date, n.tone])).toEqual([
      ["Instructions", "Cover chapter 3", null, "default"],
      ["Changes requested", "Question 2 has two right answers", "18 Oct", "bad"],
    ]);
  });

  it("quiets an addressed change request and skips blank notes", () => {
    const notes = quizNotes({
      status: "pending_review",
      note: "  ",
      reviewNote: "Fix the title",
      reviewNoteAt: null,
    });
    expect(notes).toEqual([
      { key: "review", label: "Changes requested", text: "Fix the title", date: null, tone: "default" },
    ]);
  });

  it("is empty without notes", () => {
    expect(quizNotes({ status: "draft", note: null, reviewNote: null, reviewNoteAt: null })).toEqual([]);
  });
});
