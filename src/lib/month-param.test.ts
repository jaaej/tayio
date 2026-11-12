import { describe, expect, it } from "vitest";
import { parseMonthParam, timetableLessonHref } from "./month-param";

describe("parseMonthParam", () => {
  it("reads YYYY-MM as a zero-based month", () => {
    expect(parseMonthParam("2026-10")).toEqual({ year: 2026, month: 9 });
  });

  it("defaults to the Melbourne month, not the server's", () => {
    // 31 Oct 2026, 14:00 UTC is already 1 Nov in Melbourne.
    expect(parseMonthParam(undefined, new Date("2026-10-31T14:00:00Z"))).toEqual({ year: 2026, month: 10 });
  });

  it("ignores a malformed or out-of-range value", () => {
    const now = new Date("2026-03-10T00:00:00Z");
    expect(parseMonthParam("2026-13", now)).toEqual({ year: 2026, month: 2 });
    expect(parseMonthParam("oct", now)).toEqual({ year: 2026, month: 2 });
  });
});

describe("timetableLessonHref", () => {
  const lesson = { id: "a1b2", date: "2026-11-03" };

  it("opens the lesson's month with the lesson selected", () => {
    expect(timetableLessonHref("/student/timetable", lesson)).toBe(
      "/student/timetable?month=2026-11&lesson=a1b2",
    );
  });

  it("keeps the parent's child first", () => {
    expect(timetableLessonHref("/parent/timetable", lesson, { child: "kid" })).toBe(
      "/parent/timetable?child=kid&month=2026-11&lesson=a1b2",
    );
  });
});
