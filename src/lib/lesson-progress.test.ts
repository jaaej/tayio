import { describe, expect, it } from "vitest";
import {
  addDays,
  describeLesson,
  groupLessons,
  mondayOf,
  needsFinishingCount,
  termWeekLabel,
  type LessonCounts,
} from "./lesson-progress";

const base: LessonCounts = {
  id: "l",
  date: "2026-10-12",
  startTime: "16:00:00",
  endTime: "17:00:00",
  status: "upcoming",
  roster: 6,
  marked: 0,
  absent: 0,
};
const L = (over: Partial<LessonCounts>): LessonCounts => ({ ...base, ...over });

describe("week math", () => {
  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-10-12")).toBe("2026-10-12"); // Monday
    expect(mondayOf("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(mondayOf("2026-10-01")).toBe("2026-09-28"); // across a month
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
});

describe("describeLesson", () => {
  it("reads today's lesson before it starts as open-able", () => {
    const v = describeLesson(L({}), "2026-10-12", "15:20");
    expect(v.started).toBe(false);
    expect(v.attendanceLabel).toBe("Today");
    expect(v.action).toBe("open");
  });

  it("is finished once attendance is marked, with or without notes", () => {
    const v = describeLesson(
      L({ date: "2026-10-08", marked: 6, absent: 1 }),
      "2026-10-12",
      "09:00",
    );
    expect(v.finished).toBe(true);
    expect(v.attendanceLabel).toBe("6 of 6 marked · 1 absent");
    expect(v.action).toBe("view");
  });

  it("asks for the attendance still unmarked", () => {
    const v = describeLesson(
      L({ date: "2026-10-08", marked: 3 }),
      "2026-10-12",
      "09:00",
    );
    expect(v.finished).toBe(false);
    expect(v.action).toBe("attendance");
    expect(v.attendanceTone).toBe("warn");
  });

  it("treats cancelled lessons as finished", () => {
    const v = describeLesson(
      L({ date: "2026-10-08", status: "cancelled" }),
      "2026-10-12",
      "09:00",
    );
    expect(v.finished).toBe(true);
    expect(v.attendanceLabel).toBe("Cancelled");
  });
});

describe("groupLessons", () => {
  it("splits lessons into the three sections in reading order", () => {
    const lessons = [
      L({ id: "old-done", date: "2026-09-17", marked: 6 }),
      L({ id: "old-open", date: "2026-10-05", marked: 5 }),
      L({ id: "newer-open", date: "2026-10-08", marked: 0 }),
      L({ id: "thu", date: "2026-10-15" }),
      L({ id: "today", date: "2026-10-12" }),
      L({ id: "next-week", date: "2026-10-19" }),
    ];
    const g = groupLessons(lessons, "2026-10-12", "15:00");
    expect(g.thisWeek.map((l) => l.id)).toEqual(["today", "thu"]);
    expect(g.needsFinishing.map((l) => l.id)).toEqual(["newer-open", "old-open"]);
    expect(g.done.map((l) => l.id)).toEqual(["old-done"]);
    expect(needsFinishingCount(lessons, "2026-10-12", "15:00")).toBe(2);
  });

  it("keeps a finished lesson from earlier this week in This week", () => {
    const g = groupLessons(
      [L({ id: "tue", date: "2026-10-13", marked: 6 })],
      "2026-10-15",
      "12:00",
    );
    expect(g.thisWeek.map((l) => l.id)).toEqual(["tue"]);
  });
});

describe("termWeekLabel", () => {
  const termList = [
    { id: "t3", termNumber: 3, startDate: "2026-07-13", endDate: "2026-09-18" },
    { id: "t4", termNumber: 4, startDate: "2026-10-05", endDate: "2026-12-18" },
  ];
  it("names the week, with the term when it is not the current one", () => {
    expect(termWeekLabel("2026-10-12", termList, "t4")).toBe("Week 2");
    expect(termWeekLabel("2026-09-17", termList, "t4")).toBe("Term 3, Week 10");
    expect(termWeekLabel("2026-09-25", termList, "t4")).toBeNull();
  });
});
