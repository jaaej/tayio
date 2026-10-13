import { describe, expect, it } from "vitest";
import {
  buildStudentTodo,
  buildWeekDays,
  compactTime,
  featuredSubjectName,
  nextLessonBySubject,
  nextLessonLabel,
  relativeDay,
  shortSubject,
  type DashHomework,
  type DashLesson,
  type DashWeekItem,
} from "./dashboard-rules";

// Tuesday 13 October 2026, 4:30 pm in Melbourne (AEDT, UTC+11).
const NOW = new Date("2026-10-13T05:30:00Z");
const TODAY = "2026-10-13";

const lesson = (over: Partial<DashLesson>): DashLesson => ({
  id: "l1",
  date: TODAY,
  startTime: "16:00:00",
  endTime: "17:30:00",
  status: "upcoming",
  subjectName: "Year 9 English",
  ...over,
});

const hw = (over: Partial<DashHomework>): DashHomework => ({
  homeworkId: "h1",
  title: "Persuasive paragraph draft",
  dueDay: "2026-10-16",
  status: "not_started",
  score: null,
  markedAt: null,
  subjectName: "Year 9 English",
  ...over,
});

describe("labels", () => {
  it("shortens subject names", () => {
    expect(shortSubject("Year 9 Maths")).toBe("Maths");
    expect(shortSubject("VCE Maths Methods")).toBe("Maths Methods");
    expect(shortSubject("Chemistry")).toBe("Chemistry");
  });

  it("writes compact times", () => {
    expect(compactTime("16:00:00")).toBe("4 pm");
    expect(compactTime("09:30:00")).toBe("9:30 am");
    expect(compactTime("12:00:00")).toBe("12 pm");
  });

  it("names days relative to today", () => {
    expect(relativeDay("2026-10-13", TODAY)).toBe("today");
    expect(relativeDay("2026-10-14", TODAY)).toBe("tomorrow");
    expect(relativeDay("2026-10-16", TODAY)).toBe("Fri");
    expect(relativeDay("2026-10-22", TODAY)).toBe("Thu 22 Oct");
    expect(relativeDay("2026-10-12", TODAY)).toBe("Mon 12 Oct");
  });
});

describe("next lesson", () => {
  const lessons = [
    lesson({ id: "eng", subjectName: "Year 9 English" }),
    lesson({ id: "maths", date: "2026-10-15", subjectName: "Year 9 Maths" }),
    lesson({ id: "old", date: "2026-10-12", subjectName: "Year 9 Maths" }),
    lesson({ id: "gone", date: "2026-10-14", status: "cancelled", subjectName: "Year 9 Maths" }),
  ];

  it("finds the live or next lesson per subject, skipping past and cancelled", () => {
    const next = nextLessonBySubject(lessons, NOW);
    expect(next.get("Year 9 English")).toMatchObject({ id: "eng", live: true });
    expect(next.get("Year 9 Maths")).toMatchObject({ id: "maths", live: false });
  });

  it("features the subject on now over a later one", () => {
    expect(featuredSubjectName(nextLessonBySubject(lessons, NOW))).toBe("Year 9 English");
  });

  it("features the soonest when nothing is on", () => {
    const later = new Date("2026-10-13T08:00:00Z"); // 7 pm
    expect(featuredSubjectName(nextLessonBySubject(lessons, later))).toBe("Year 9 Maths");
  });

  it("labels the lesson", () => {
    const next = nextLessonBySubject(lessons, NOW);
    expect(nextLessonLabel(next.get("Year 9 English"), TODAY)).toBe("On now until 5:30 pm");
    expect(nextLessonLabel(next.get("Year 9 Maths"), TODAY)).toBe("Next lesson Thu 4 pm");
    expect(nextLessonLabel(undefined, TODAY)).toBe("No lessons booked");
  });
});

describe("buildStudentTodo", () => {
  const week: DashWeekItem = {
    subjectId: "s-maths",
    subjectName: "Year 9 Maths",
    subjectWeekId: "w2",
    weekNumber: 2,
    weekTitle: "Simultaneous equations",
    quiz: { id: "q1", title: "Week 2 practice quiz", questionCount: 10 },
    quizDone: false,
    hasVideo: true,
    videoWatched: false,
  };

  it("orders by urgency and gives each row one action", () => {
    const todo = buildStudentTodo({
      homework: [
        hw({ homeworkId: "later", dueDay: "2026-10-20" }),
        hw({ homeworkId: "soon", dueDay: "2026-10-14", status: "viewed" }),
        hw({ homeworkId: "late", dueDay: "2026-10-10" }),
        hw({ homeworkId: "back", status: "resubmission_requested" }),
        hw({
          homeworkId: "marked",
          status: "marked",
          score: "91.67",
          markedAt: new Date("2026-10-12T00:00:00Z"),
          subjectName: "Year 9 Maths",
        }),
        hw({ homeworkId: "done", status: "submitted" }),
      ],
      weekItems: [week],
      outstanding: null,
      todayIso: TODAY,
      now: NOW,
    });
    expect(todo.map((row) => row.key)).toEqual([
      "hw-late",
      "hw-back",
      "hw-soon",
      "quiz-q1",
      "video-w2",
      "hw-later",
      "marked-marked",
    ]);
    expect(todo[0]).toMatchObject({ detail: "English · was due Sat 10 Oct", action: "Start" });
    expect(todo[1]).toMatchObject({ detail: "English · sent back for changes", action: "Resubmit" });
    expect(todo[2]).toMatchObject({ detail: "English · due tomorrow", action: "Continue" });
    expect(todo[3]).toMatchObject({
      detail: "Maths · Week 2 · 10 questions",
      href: "/student/quizzes/q1",
    });
    expect(todo[4]).toMatchObject({
      title: "Watch Week 2: Simultaneous equations",
      href: "/student/subjects/s-maths?week=w2",
    });
    expect(todo[6]).toMatchObject({ detail: "Maths · marked 91.7%", action: "See feedback" });
  });

  it("collapses more than two overdue items into one row", () => {
    const todo = buildStudentTodo({
      homework: [
        hw({ homeworkId: "a", title: "Oldest", dueDay: "2026-05-28" }),
        hw({ homeworkId: "b", dueDay: "2026-07-07" }),
        hw({ homeworkId: "c", dueDay: "2026-10-01" }),
        hw({ homeworkId: "soon", dueDay: TODAY }),
      ],
      weekItems: [],
      outstanding: null,
      todayIso: TODAY,
      now: NOW,
    });
    expect(todo.map((row) => row.key)).toEqual(["overdue", "hw-soon"]);
    expect(todo.map((row) => row.count)).toEqual([3, 1]);
    expect(todo[0]).toMatchObject({
      title: "3 overdue pieces of homework",
      detail: "Oldest: Oldest",
      href: "/student/homework",
    });
  });

  it("drops a finished quiz, a watched video and old marks", () => {
    const todo = buildStudentTodo({
      homework: [
        hw({
          status: "marked",
          score: "80",
          markedAt: new Date("2026-09-01T00:00:00Z"),
        }),
      ],
      weekItems: [{ ...week, quizDone: true, videoWatched: true }],
      outstanding: null,
      todayIso: TODAY,
      now: NOW,
    });
    expect(todo).toEqual([]);
  });

  it("adds an unpaid balance after urgent homework", () => {
    const todo = buildStudentTodo({
      homework: [hw({ homeworkId: "soon", dueDay: TODAY })],
      weekItems: [week],
      outstanding: 120,
      outstandingLabel: "$120.00 outstanding",
      todayIso: TODAY,
      now: NOW,
    });
    expect(todo.map((row) => row.kind)).toEqual(["due-soon", "payment", "quiz", "video"]);
  });
});

describe("buildWeekDays", () => {
  it("lays out Monday to Sunday with lessons and open homework", () => {
    const days = buildWeekDays({
      weekStartIso: "2026-10-12",
      todayIso: TODAY,
      now: NOW,
      lessons: [
        lesson({ id: "eng" }),
        lesson({ id: "maths", date: "2026-10-15", subjectName: "Year 9 Maths" }),
        lesson({ id: "gone", date: "2026-10-14", status: "cancelled" }),
      ],
      homework: [
        hw({ homeworkId: "open", dueDay: "2026-10-16" }),
        hw({ homeworkId: "handed", dueDay: "2026-10-16", status: "submitted" }),
      ],
    });
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ weekday: "Mon", dayNumber: 12, isPast: true, isToday: false });
    expect(days[1]).toMatchObject({ isToday: true });
    expect(days[1].lessons).toEqual([
      { id: "eng", subjectName: "Year 9 English", label: "English · on now", live: true, past: false },
    ]);
    expect(days[2].lessons).toEqual([]);
    expect(days[3].lessons[0]).toMatchObject({ label: "Maths · 4 pm", past: false });
    expect(days[4].due.map((d) => d.homeworkId)).toEqual(["open"]);
    expect(days[6]).toMatchObject({ weekday: "Sun", dayNumber: 18 });
  });
});
