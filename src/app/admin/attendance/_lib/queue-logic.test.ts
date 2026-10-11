import { describe, expect, it } from "vitest";
import {
  buildQueue,
  dateParam,
  lessonQueueState,
  nextLessonId,
  parseQueueView,
  queueQueryString,
} from "./queue-logic";

// 2026-10-11 14:00 in Melbourne (AEDT, UTC+11).
const NOW = new Date("2026-10-11T03:00:00.000Z");

describe("lessonQueueState", () => {
  const base = { date: "2026-10-11", startTime: "13:00:00", status: "upcoming", unmarkedCount: 3 };

  it("marks a started lesson with unmarked students as to mark", () => {
    expect(lessonQueueState(base, NOW)).toBe("to_mark");
  });

  it("treats a started lesson with every student marked as marked", () => {
    expect(lessonQueueState({ ...base, unmarkedCount: 0 }, NOW)).toBe("marked");
  });

  it("uses Melbourne wall time, not server time, to decide if a lesson started", () => {
    expect(lessonQueueState({ ...base, startTime: "14:30:00" }, NOW)).toBe("upcoming");
    expect(lessonQueueState({ ...base, startTime: "14:00:00" }, NOW)).toBe("to_mark");
  });

  it("files cancelled and rescheduled lessons separately", () => {
    expect(lessonQueueState({ ...base, status: "cancelled" }, NOW)).toBe("cancelled");
    expect(lessonQueueState({ ...base, status: "rescheduled", date: "2026-10-20" }, NOW)).toBe("cancelled");
  });
});

describe("buildQueue", () => {
  const lessons = [
    { id: "a", date: "2026-10-09", startTime: "16:00:00", state: "to_mark" as const },
    { id: "b", date: "2026-10-11", startTime: "09:00:00", state: "to_mark" as const },
    { id: "c", date: "2026-10-10", startTime: "16:00:00", state: "cancelled" as const },
    { id: "d", date: "2026-10-12", startTime: "16:00:00", state: "upcoming" as const },
    { id: "e", date: "2026-10-11", startTime: "18:00:00", state: "upcoming" as const },
    { id: "f", date: "2026-10-10", startTime: "17:00:00", state: "marked" as const },
  ];

  it("orders finished work most recent first", () => {
    expect(buildQueue(lessons, "to_mark").map((l) => l.id)).toEqual(["b", "a"]);
    expect(buildQueue(lessons, "marked").map((l) => l.id)).toEqual(["f", "c"]);
  });

  it("orders upcoming lessons soonest first", () => {
    expect(buildQueue(lessons, "upcoming").map((l) => l.id)).toEqual(["e", "d"]);
  });
});

describe("nextLessonId", () => {
  it("returns the lesson after the current one", () => {
    expect(nextLessonId(["a", "b", "c"], "a")).toBe("b");
  });

  it("returns null at the end of the queue", () => {
    expect(nextLessonId(["a", "b", "c"], "c")).toBeNull();
    expect(nextLessonId([], "a")).toBeNull();
  });

  it("starts from the top when the current lesson is not in the queue", () => {
    expect(nextLessonId(["b", "c"], "a")).toBe("b");
  });
});

describe("URL params", () => {
  it("defaults unknown views to to mark", () => {
    expect(parseQueueView(undefined)).toBe("to_mark");
    expect(parseQueueView("bogus")).toBe("to_mark");
    expect(parseQueueView("upcoming")).toBe("upcoming");
  });

  it("rejects impossible dates", () => {
    expect(dateParam("2026-10-11")).toBe("2026-10-11");
    expect(dateParam("2026-13-45")).toBeNull();
    expect(dateParam("2026-02-30")).toBeNull();
    expect(dateParam("yesterday")).toBeNull();
  });

  it("keeps only non-default filters in the query string", () => {
    expect(queueQueryString({ view: "to_mark", date: null, from: null })).toBe("");
    expect(queueQueryString({ view: "marked", date: "2026-10-11", from: null })).toBe(
      "?view=marked&date=2026-10-11",
    );
  });
});
