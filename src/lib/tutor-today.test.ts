import { describe, expect, it } from "vitest";
import {
  isoDayDiff,
  lessonDatesLabel,
  lessonTiming,
  nearDayLabel,
  pickTodaysLesson,
  summariseBumps,
  weekStatusLine,
} from "./tutor-today";
import { lessonStartInstant } from "./tutor-cover-rules";

// 12 Oct 2026 is a Monday, in Melbourne daylight time (UTC+11).
const at = (time: string) => lessonStartInstant("2026-10-12", time);

describe("lessonTiming", () => {
  it("counts down within the hour", () => {
    expect(lessonTiming("2026-10-12", "16:00", "17:00", at("15:20"))).toEqual({
      state: "soon",
      label: "In 40 min",
      tone: "warn",
    });
  });

  it("uses hours further out", () => {
    expect(lessonTiming("2026-10-12", "16:00", "17:00", at("13:00")).label).toBe("In 3 h");
    expect(lessonTiming("2026-10-12", "16:00", "17:00", at("13:45")).label).toBe("In 2 h 15 min");
    expect(lessonTiming("2026-10-12", "16:00", "17:00", at("13:45")).tone).toBe("neutral");
  });

  it("reports a lesson in progress and a finished one", () => {
    expect(lessonTiming("2026-10-12", "16:00", "17:00", at("16:30")).state).toBe("now");
    expect(lessonTiming("2026-10-12", "16:00", "17:00", at("17:00")).state).toBe("done");
  });
});

describe("pickTodaysLesson", () => {
  const lessons = [
    { id: "b", date: "2026-10-12", startTime: "17:15", endTime: "18:00" },
    { id: "a", date: "2026-10-12", startTime: "16:00", endTime: "17:00" },
  ];
  it("prefers the lesson in progress or next", () => {
    expect(pickTodaysLesson(lessons, at("09:00"))?.id).toBe("a");
    expect(pickTodaysLesson(lessons, at("16:30"))?.id).toBe("a");
    expect(pickTodaysLesson(lessons, at("17:05"))?.id).toBe("b");
  });
  it("falls back to the last lesson once the day is over", () => {
    expect(pickTodaysLesson(lessons, at("19:00"))?.id).toBe("b");
  });
  it("is null with no lessons", () => {
    expect(pickTodaysLesson([], at("09:00"))).toBeNull();
  });
});

describe("date labels", () => {
  it("diffs ISO dates both ways", () => {
    expect(isoDayDiff("2026-10-12", "2026-10-15")).toBe(3);
    expect(isoDayDiff("2026-10-12", "2026-10-05")).toBe(-7);
    expect(isoDayDiff("2026-10-12", "2026-10-12")).toBe(0);
  });

  it("names nearby days", () => {
    expect(nearDayLabel("2026-10-12", "2026-10-12")).toBe("Today");
    expect(nearDayLabel("2026-10-13", "2026-10-12")).toBe("Tomorrow");
    expect(nearDayLabel("2026-10-11", "2026-10-12")).toBe("Yesterday");
    expect(nearDayLabel("2026-10-08", "2026-10-12")).toBe("Thu");
    expect(nearDayLabel("2026-10-05", "2026-10-12")).toBe("5 Oct");
  });

  it("lists lesson dates with the month once", () => {
    expect(lessonDatesLabel(["2026-10-05"])).toBe("Mon 5 Oct");
    expect(lessonDatesLabel(["2026-10-08", "2026-10-05"])).toBe("Mon 5 and Thu 8 Oct");
    expect(lessonDatesLabel(["2026-09-30", "2026-10-01", "2026-10-02"])).toBe(
      "Wed 30 Sept, Thu 1 and Fri 2 Oct",
    );
  });
});

describe("summariseBumps", () => {
  const base = { firstName: "A", className: "Year 9 Maths" };
  it("groups by student and sorts the worst first", () => {
    const rows = summariseBumps(
      [
        { ...base, studentId: "mia", lastName: "Chen", dueIso: "2026-10-11" },
        { ...base, studentId: "lucas", lastName: "Tran", dueIso: "2026-10-09" },
        { ...base, studentId: "lucas", lastName: "Tran", dueIso: "2026-10-03" },
      ],
      "2026-10-12",
    );
    expect(rows.map((r) => r.studentId)).toEqual(["lucas", "mia"]);
    expect(rows[0]).toMatchObject({
      overdueCount: 2,
      oldestDays: 9,
      reason: "2 overdue · 9d late",
      tone: "bad",
    });
    expect(rows[1]).toMatchObject({ reason: "1 day overdue", tone: "warn" });
  });

  it("marks three pieces behind as red even when recent", () => {
    const rows = summariseBumps(
      ["2026-10-09", "2026-10-10", "2026-10-11"].map((dueIso) => ({
        ...base,
        studentId: "s",
        lastName: "S",
        dueIso,
      })),
      "2026-10-12",
    );
    expect(rows[0].tone).toBe("bad");
  });
});

describe("weekStatusLine", () => {
  const today = "2026-10-12";
  it("joins the facts in sentence case", () => {
    expect(
      weekStatusLine({
        hasRecording: true,
        lessonDone: true,
        quizStatus: "changes_requested",
        homeworkDueIso: "2026-10-15",
        todayIso: today,
      }),
    ).toBe("Class recording added · quiz needs changes · homework due Thu");
  });

  it("says nothing about a recording before the lesson ends", () => {
    expect(
      weekStatusLine({
        hasRecording: false,
        lessonDone: false,
        quizStatus: null,
        homeworkDueIso: null,
        todayIso: today,
      }),
    ).toBe("No homework set");
  });

  it("flags a missing recording after the lesson and near due dates", () => {
    expect(
      weekStatusLine({
        hasRecording: false,
        lessonDone: true,
        quizStatus: "draft",
        homeworkDueIso: "2026-10-13",
        todayIso: today,
      }),
    ).toBe("No class recording yet · homework due tomorrow");
  });
});
