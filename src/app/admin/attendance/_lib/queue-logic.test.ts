import { describe, expect, it } from "vitest";
import {
  dateParam,
  groupByTutor,
  lessonQueueState,
  nextLessonId,
  parseQueueView,
  queueQueryString,
  classParam,
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

describe("groupByTutor", () => {
  const item = (id: string, tutorId: string, tutorName: string, date: string, startTime = "16:00:00") => ({
    id,
    tutorId,
    tutorName,
    date,
    startTime,
  });

  it("groups lessons by tutor, tutors by name, latest lesson first", () => {
    const groups = groupByTutor([
      item("a", "t2", "Wei Chen", "2026-10-09"),
      item("b", "t1", "Hana Park", "2026-10-01"),
      item("c", "t2", "Wei Chen", "2026-10-11", "09:00:00"),
      item("d", "t2", "Wei Chen", "2026-10-11", "17:00:00"),
    ]);
    expect(groups.map((g) => g.tutorName)).toEqual(["Hana Park", "Wei Chen"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["d", "c", "a"]);
  });

  it("keeps two tutors with the same name apart", () => {
    const groups = groupByTutor([
      item("a", "t1", "Sam Lee", "2026-10-09"),
      item("b", "t2", "Sam Lee", "2026-10-09"),
    ]);
    expect(groups).toHaveLength(2);
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
    expect(parseQueueView("notes")).toBe("notes");
  });

  it("rejects impossible dates", () => {
    expect(dateParam("2026-10-11")).toBe("2026-10-11");
    expect(dateParam("2026-13-45")).toBeNull();
    expect(dateParam("2026-02-30")).toBeNull();
    expect(dateParam("yesterday")).toBeNull();
  });

  it("keeps only non-default filters in the query string", () => {
    expect(queueQueryString({ view: "to_mark", date: null, from: null, classId: null })).toBe("");
    expect(
      queueQueryString({ view: "marked", date: "2026-10-11", from: null, classId: null }),
    ).toBe("?view=marked&date=2026-10-11");
  });

  it("keeps the class filter", () => {
    expect(
      queueQueryString({
        view: "marked",
        date: null,
        from: null,
        classId: "14c3c5ed-9038-46e0-865b-7bfb79b73f94",
      }),
    ).toBe("?view=marked&class=14c3c5ed-9038-46e0-865b-7bfb79b73f94");
  });

  it("reads only a real class id", () => {
    expect(classParam("14c3c5ed-9038-46e0-865b-7bfb79b73f94")).toBe(
      "14c3c5ed-9038-46e0-865b-7bfb79b73f94",
    );
    expect(classParam("not-a-class")).toBeNull();
    expect(classParam(undefined)).toBeNull();
  });
});
