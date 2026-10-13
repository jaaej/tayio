import { describe, expect, it } from "vitest";
import {
  checklistProgress,
  curriculumWeekUnlockDate,
  pastDayLabel,
  unlockLabel,
  weekChecklist,
  weekComplete,
  type ChecklistWeek,
} from "./week-checklist";

// Tue 13 Oct 2026, 10:00 in Melbourne (AEDT, UTC+11).
const NOW = new Date("2026-10-12T23:00:00Z");

function week(overrides: Partial<ChecklistWeek> = {}): ChecklistWeek {
  return {
    videoUrl: "videos/w2.mp4",
    bookletUrl: "booklets/w2.pdf",
    videoWatchedAt: null,
    bookletOpenedAt: null,
    homework: [],
    quiz: null,
    quizAttempt: null,
    ...overrides,
  };
}

const hw = (
  id: string,
  status: string,
  due: string,
  score: string | null = null,
) => ({ homeworkId: id, title: `Homework ${id}`, dueDate: new Date(due), status, score });

describe("weekChecklist", () => {
  it("lists video, booklet, homework by due date, then the quiz", () => {
    const tasks = weekChecklist(
      week({
        homework: [
          hw("b", "not_started", "2026-10-20T06:00:00Z"),
          hw("a", "not_started", "2026-10-17T06:00:00Z"),
        ],
        quiz: { id: "q1", title: "Elimination quiz", questionCount: 5 },
      }),
      { now: NOW, tutorFirstName: "Tom" },
    );
    expect(tasks.map((t) => t.key)).toEqual([
      "video",
      "booklet",
      "homework-a",
      "homework-b",
      "quiz-q1",
    ]);
    expect(tasks[2]).toMatchObject({
      state: "todo",
      meta: "Due Sat 17 Oct",
      href: "/student/homework/a",
    });
    expect(tasks[4]).toMatchObject({
      state: "todo",
      meta: "Practice quiz · 5 questions",
      href: "/student/quizzes/q1",
    });
  });

  it("leaves the quiz out until it is approved", () => {
    const tasks = weekChecklist(week(), { now: NOW, tutorFirstName: "Tom" });
    expect(tasks.some((t) => t.kind === "quiz")).toBe(false);
  });

  it("shows missing uploads as waiting on the tutor", () => {
    const tasks = weekChecklist(week({ videoUrl: null, bookletUrl: null }), {
      now: NOW,
      tutorFirstName: "Tom",
    });
    expect(tasks[0]).toMatchObject({ state: "waiting", meta: "Tom will upload it soon" });
    expect(tasks[1]).toMatchObject({ state: "waiting" });
    const anon = weekChecklist(week({ videoUrl: null }), { now: NOW, tutorFirstName: null });
    expect(anon[0].meta).toBe("Your tutor will upload it soon");
  });

  it("marks watched and opened items done with a relative day", () => {
    const tasks = weekChecklist(
      week({
        videoWatchedAt: new Date("2026-10-11T02:00:00Z"), // Sun
        bookletOpenedAt: new Date("2026-10-12T22:00:00Z"), // today
      }),
      { now: NOW, tutorFirstName: "Tom" },
    );
    expect(tasks[0]).toMatchObject({ state: "done", meta: "Watched Sun" });
    expect(tasks[1]).toMatchObject({ state: "done", meta: "Opened today" });
  });

  it("covers every homework status", () => {
    const tasks = weekChecklist(
      week({
        homework: [
          hw("sub", "submitted", "2026-10-10T06:00:00Z"),
          hw("late", "late", "2026-10-10T06:00:01Z"),
          hw("mark", "marked", "2026-10-10T06:00:02Z", "92.5"),
          hw("over", "viewed", "2026-10-10T06:00:03Z"),
          hw("re", "resubmission_requested", "2026-10-15T06:00:00Z"),
        ],
      }),
      { now: NOW, tutorFirstName: "Tom" },
    );
    const byKey = Object.fromEntries(tasks.map((t) => [t.key, t]));
    expect(byKey["homework-sub"]).toMatchObject({ state: "done", meta: "Submitted · waiting for marking" });
    expect(byKey["homework-late"]).toMatchObject({ state: "done" });
    expect(byKey["homework-mark"]).toMatchObject({ state: "done", meta: "Marked · 92.5%" });
    expect(byKey["homework-over"]).toMatchObject({ state: "overdue", meta: "Overdue · was due Sat 10 Oct" });
    expect(byKey["homework-re"]).toMatchObject({ state: "todo", meta: "Resubmit · due Thu 15 Oct" });
  });

  it("treats homework due today as not yet overdue", () => {
    const [, , task] = weekChecklist(
      week({ homework: [hw("t", "not_started", "2026-10-13T08:00:00Z")] }),
      { now: NOW, tutorFirstName: "Tom" },
    );
    expect(task.state).toBe("todo");
  });

  it("shows the latest quiz score once attempted", () => {
    const tasks = weekChecklist(
      week({
        quiz: { id: "q1", title: "Quiz", questionCount: 1 },
        quizAttempt: { correctCount: 4, total: 5 },
      }),
      { now: NOW, tutorFirstName: "Tom" },
    );
    expect(tasks.at(-1)).toMatchObject({ state: "done", meta: "Practice quiz · 4/5 correct" });
  });
});

describe("checklistProgress and weekComplete", () => {
  it("counts only what is available", () => {
    const tasks = weekChecklist(
      week({ bookletUrl: null, videoWatchedAt: new Date("2026-10-11T02:00:00Z") }),
      { now: NOW, tutorFirstName: "Tom" },
    );
    expect(checklistProgress(tasks)).toEqual({ done: 1, total: 1 });
    expect(weekComplete(tasks)).toBe(true);
  });

  it("is never complete with nothing to do", () => {
    const tasks = weekChecklist(week({ videoUrl: null, bookletUrl: null }), {
      now: NOW,
      tutorFirstName: "Tom",
    });
    expect(checklistProgress(tasks)).toEqual({ done: 0, total: 0 });
    expect(weekComplete(tasks)).toBe(false);
  });
});

describe("dates", () => {
  it("releases each week 7 days after the last", () => {
    expect(curriculumWeekUnlockDate("2026-10-05", 1)).toBe("2026-10-05");
    expect(curriculumWeekUnlockDate("2026-10-05", 3)).toBe("2026-10-19");
  });

  it("formats the unlock tooltip", () => {
    expect(unlockLabel("2026-10-19")).toBe("Unlocks Mon 19 Oct");
  });

  it("labels past days relative to Melbourne today", () => {
    expect(pastDayLabel(new Date("2026-10-12T02:00:00Z"), NOW)).toBe("yesterday");
    expect(pastDayLabel(new Date("2026-09-20T02:00:00Z"), NOW)).toBe("Sun 20 Sept");
  });
});
