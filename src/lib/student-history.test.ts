import { describe, expect, it } from "vitest";
import {
  RECENT_LESSONS,
  homeworkHistory,
  keyNumbers,
  lessonTimeline,
  staffNotesTimeline,
  type HistoryLesson,
} from "./student-history";

const lesson = (over: Partial<HistoryLesson>): HistoryLesson => ({
  lessonId: "l1",
  date: "2026-06-16",
  startTime: "16:00:00",
  className: "Year 9 English",
  status: "present",
  moved: false,
  rollNote: null,
  tutorId: "t1",
  ...over,
});

const noteOn = (over: Partial<HistoryLesson>, note: string) => {
  const { lessonId, date, startTime, className, tutorId } = lesson(over);
  return { lesson: { lessonId, date, startTime, className, tutorId }, note };
};

describe("lessonTimeline", () => {
  it("lists newest first with the shared labels", () => {
    const rows = lessonTimeline(
      [
        lesson({ lessonId: "a", date: "2026-06-09" }),
        lesson({ lessonId: "b", date: "2026-06-16", status: "absent", moved: true }),
        lesson({ lessonId: "c", date: "2026-06-23", status: null }),
        lesson({ lessonId: "d", date: "2026-06-23", startTime: "09:00:00", status: "left_early" }),
      ],
      [],
    );
    expect(rows.map((r) => [r.lessonId, r.label, r.tone])).toEqual([
      ["c", "Not marked", "warn"],
      ["d", "Left early", "warn"],
      ["b", "Moved", "default"],
      ["a", "Present", "good"],
    ]);
  });

  it("puts each lesson's mark, roll note and notes together", () => {
    const rows = lessonTimeline(
      [
        lesson({ lessonId: "l1", date: "2026-10-05", rollNote: "Arrived late" }),
        lesson({ lessonId: "l2", date: "2026-10-12", status: "absent", moved: true }),
      ],
      [noteOn({ lessonId: "l1", date: "2026-10-05" }, "mine"), noteOn({ lessonId: "l1", date: "2026-10-05" }, "theirs")],
    );
    expect(rows.map((r) => r.lessonId)).toEqual(["l2", "l1"]);
    expect(rows[1]).toMatchObject({ rollNote: "Arrived late", notes: ["mine", "theirs"] });
    expect(rows[0].notes).toEqual([]);
  });

  it("gives a note on a lesson with no record of the student its own entry", () => {
    const rows = lessonTimeline([], [noteOn({ lessonId: "l3", date: "2026-10-19", tutorId: "t2" }, "theirs")]);
    expect(rows).toEqual([
      expect.objectContaining({ lessonId: "l3", tutorId: "t2", status: null, label: "Not marked", notes: ["theirs"] }),
    ]);
  });

  it("keeps a lesson once: its mark over a cancellation over not marked", () => {
    const rows = lessonTimeline(
      [
        lesson({ lessonId: "a", status: null }),
        lesson({ lessonId: "a", status: null, cancelled: true }),
        lesson({ lessonId: "b", status: null, cancelled: true }),
        lesson({ lessonId: "b", status: "present" }),
      ],
      [],
    );
    expect(rows.map((r) => [r.lessonId, r.label])).toEqual([
      ["a", "Cancelled by Taiyo"],
      ["b", "Present"],
    ]);
  });

  it("is empty for a student with no lessons yet", () => {
    expect(lessonTimeline([], [])).toEqual([]);
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

  it("keeps the caller's extra fields on each row", () => {
    const [row] = homeworkHistory([{ ...task({}), feedback: "Well done" }], "2026-10-18");
    expect(row.feedback).toBe("Well done");
  });
});

describe("keyNumbers", () => {
  const today = "2026-10-18";
  const hw = (homeworkId: string, status: string, dueDate: string, score: string | null = null) =>
    homeworkHistory([{ homeworkId, title: homeworkId, className: null, dueDate, status, score }], today)[0];
  const numbers = (input: Partial<Parameters<typeof keyNumbers>[0]>) =>
    Object.fromEntries(
      keyNumbers({ timeline: [], homework: [], quizAttempts: [], noteDates: [], today, ...input }).map((n) => [
        n.label,
        n,
      ]),
    );

  it("reads as nothing yet for a new student", () => {
    const n = numbers({});
    expect(n.Attendance).toMatchObject({ value: "-", sub: "no lessons marked yet" });
    expect(n.Homework).toMatchObject({ value: "-", sub: "nothing due yet" });
    expect(n["Average score"]).toMatchObject({ value: "-", sub: "nothing marked yet" });
    expect(n["Lesson notes"]).toMatchObject({ value: "0", sub: "none yet" });
  });

  it("counts attendance over the recent marked lessons only", () => {
    const timeline = lessonTimeline(
      [
        lesson({ lessonId: "new", date: "2026-10-17", status: null }),
        lesson({ lessonId: "cx", date: "2026-10-16", status: null, cancelled: true }),
        lesson({ lessonId: "abs", date: "2026-10-15", status: "absent" }),
        lesson({ lessonId: "mv", date: "2026-10-14", status: "absent", moved: true }),
        ...Array.from({ length: RECENT_LESSONS }, (_, i) =>
          lesson({ lessonId: `p${i}`, date: `2026-09-${String(10 + i).padStart(2, "0")}` }),
        ),
      ],
      [],
    );
    // The last 8 marks: absent, moved (left out of the rate) and 6 present.
    expect(numbers({ timeline }).Attendance).toMatchObject({
      value: "86%",
      sub: "6 of 7 recent lessons",
      tone: "warn",
    });
  });

  it("counts homework handed in of what is due so far", () => {
    const n = numbers({
      homework: [
        hw("a", "marked", "2026-10-01", "80"),
        hw("b", "submitted", "2026-10-10"),
        hw("c", "not_started", "2026-10-11"),
        hw("d", "not_started", "2026-10-25"),
      ],
    });
    expect(n.Homework).toMatchObject({ value: "2 of 3", sub: "1 overdue · 1 to mark", tone: "bad" });
    expect(n["Average score"]).toMatchObject({ value: "80%", sub: "1 homework" });
  });

  it("blends marked homework and quizzes in the average", () => {
    const n = numbers({
      homework: [hw("a", "marked", "2026-10-01", "90")],
      quizAttempts: [{ correctCount: 7, total: 10 }],
    });
    expect(n["Average score"]).toMatchObject({ value: "80%", sub: "1 homework · 1 quiz" });
  });

  it("counts lesson notes with the latest date", () => {
    expect(numbers({ noteDates: ["2026-06-20", "2026-06-27", "2026-06-13"] })["Lesson notes"]).toMatchObject({
      value: "3",
      sub: "latest 27 June",
    });
  });
});

describe("staffNotesTimeline", () => {
  const range = (a: string, b: string) => `${a} to ${b}`;

  it("lists leave and trial notes newest first, skipping blanks", () => {
    const notes = staffNotesTimeline({
      leave: [
        { id: "v1", startDate: "2026-07-01", endDate: "2026-07-10", note: "Family trip" },
        { id: "v2", startDate: "2026-08-01", endDate: "2026-08-02", note: "  " },
      ],
      trial: { startDate: "2026-05-01", endDate: "2026-05-14", note: "Go easy on homework" },
      formatRange: range,
    });
    expect(notes.map((n) => [n.kind, n.date, n.source, n.text])).toEqual([
      ["leave", "2026-07-01", "2026-07-01 to 2026-07-10", "Family trip"],
      ["trial", "2026-05-01", "2026-05-01 to 2026-05-14", "Go easy on homework"],
    ]);
  });

  it("is empty when there are no notes", () => {
    expect(staffNotesTimeline({ leave: [], trial: null, formatRange: range })).toEqual([]);
  });
});
