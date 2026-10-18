import { describe, expect, it } from "vitest";
import { attendanceHistory, homeworkHistory, staffNotesTimeline } from "./student-history";

const lesson = (over: Partial<Parameters<typeof attendanceHistory>[0][number]>) => ({
  lessonId: "l1",
  date: "2026-06-16",
  startTime: "16:00:00",
  className: "Year 9 English",
  status: "present" as string | null,
  moved: false,
  ...over,
});

describe("attendanceHistory", () => {
  it("lists newest first with the shared labels", () => {
    const { rows } = attendanceHistory([
      lesson({ lessonId: "a", date: "2026-06-09" }),
      lesson({ lessonId: "b", date: "2026-06-16", status: "absent", moved: true }),
      lesson({ lessonId: "c", date: "2026-06-23", status: null }),
      lesson({ lessonId: "d", date: "2026-06-23", startTime: "09:00:00", status: "left_early" }),
    ]);
    expect(rows.map((r) => [r.lessonId, r.label, r.tone])).toEqual([
      ["c", "Not marked", "warn"],
      ["d", "Left early", "warn"],
      ["b", "Moved", "default"],
      ["a", "Present", "good"],
    ]);
  });

  it("leaves moved and unmarked lessons out of the rate", () => {
    const { summary } = attendanceHistory([
      lesson({ lessonId: "a" }),
      lesson({ lessonId: "b", status: "absent", moved: true }),
      lesson({ lessonId: "c", status: "absent" }),
      lesson({ lessonId: "d", status: null }),
      lesson({ lessonId: "e", status: "left_early" }),
    ]);
    expect(summary).toEqual({ attended: 2, absent: 1, total: 3, percent: 67 });
  });
});

describe("homeworkHistory", () => {
  const task = (over: Partial<Parameters<typeof homeworkHistory>[0][number]>) => ({
    homeworkId: "h1",
    title: "Worksheet",
    className: "Year 9 Maths",
    dueDate: "2026-10-10",
    status: "not_started",
    score: null,
    ...over,
  });

  it("uses the shared state: a late hand-in is to mark, not overdue", () => {
    const rows = homeworkHistory(
      [
        task({ homeworkId: "a", status: "late", dueDate: "2026-10-01" }),
        task({ homeworkId: "b", status: "not_started", dueDate: "2026-10-01" }),
        task({ homeworkId: "c", status: "marked", dueDate: "2026-09-01", score: "85" }),
        task({ homeworkId: "d", status: "viewed", dueDate: "2026-10-18" }),
      ],
      "2026-10-18",
    );
    expect(rows.map((r) => [r.homeworkId, r.label, r.tone])).toEqual([
      ["d", "Due today", "warn"],
      ["a", "To mark", "warn"],
      ["b", "Overdue", "bad"],
      ["c", "Marked", "good"],
    ]);
  });
});

describe("staffNotesTimeline", () => {
  const range = (a: string, b: string) => `${a} to ${b}`;

  it("puts every note in one list, newest first, skipping blanks", () => {
    const notes = staffNotesTimeline({
      lessonNotes: [
        { lessonId: "l1", date: "2026-06-16", className: "English", tutorName: "Dan", text: "Quiet today" },
        { lessonId: "l2", date: "2026-06-23", className: "English", tutorName: "Dan", text: "  " },
      ],
      rollNotes: [{ lessonId: "l1", date: "2026-06-16", className: "English", text: "Arrived 10 min late" }],
      leave: [{ id: "v1", startDate: "2026-07-01", endDate: "2026-07-10", note: "Family trip" }],
      trial: { startDate: "2026-05-01", endDate: "2026-05-14", note: "Go easy on homework" },
      formatRange: range,
    });
    expect(notes.map((n) => [n.kind, n.date, n.source, n.text])).toEqual([
      ["leave", "2026-07-01", "2026-07-01 to 2026-07-10", "Family trip"],
      ["lesson", "2026-06-16", "English · Dan", "Quiet today"],
      ["roll", "2026-06-16", "English", "Arrived 10 min late"],
      ["trial", "2026-05-01", "2026-05-01 to 2026-05-14", "Go easy on homework"],
    ]);
  });

  it("is empty when there are no notes", () => {
    expect(
      staffNotesTimeline({ lessonNotes: [], rollNotes: [], leave: [], trial: null, formatRange: range }),
    ).toEqual([]);
  });
});
