import { describe, expect, it } from "vitest";
import { rankWatchList, watchSignalsFrom } from "./watch-rules";

describe("watchSignalsFrom", () => {
  it("flags two or more absences in the counted lessons", () => {
    const signals = watchSignalsFrom(
      [
        { studentId: "a", status: "absent" },
        { studentId: "a", status: "absent" },
        { studentId: "a", status: "present" },
        { studentId: "b", status: "absent" },
        { studentId: "b", status: "late" },
      ],
      [],
    );
    expect(signals.absences.get("a")).toEqual({ absent: 2, counted: 3 });
    expect(signals.absences.has("b")).toBe(false);
  });

  it("does not count a moved lesson as an absence", () => {
    const signals = watchSignalsFrom(
      [
        { studentId: "a", status: "absent", moved: true },
        { studentId: "a", status: "absent" },
        { studentId: "a", status: "left_early" },
      ],
      [],
    );
    expect(signals.absences.has("a")).toBe(false);
  });

  it("counts overdue homework per student from two tasks", () => {
    const signals = watchSignalsFrom([], ["a", "a", "b", "a"]);
    expect(signals.overdueHomework.get("a")).toBe(3);
    expect(signals.overdueHomework.has("b")).toBe(false);
  });
});

describe("rankWatchList", () => {
  it("puts absences first and names each student once", () => {
    const signals = watchSignalsFrom(
      [
        { studentId: "a", status: "absent" },
        { studentId: "a", status: "absent" },
      ],
      ["a", "a", "b", "b", "b", "c", "c"],
    );
    const ranked = rankWatchList(signals, 5);
    expect(ranked.map((r) => r.studentId)).toEqual(["a", "b", "c"]);
    expect(ranked[0].why).toEqual({
      reason: "Missed 2 of last 2 lessons",
      tone: "bad",
      section: "attendance",
    });
    expect(ranked[1].why).toEqual({
      reason: "3 homework tasks overdue",
      tone: "warn",
      section: "homework",
    });
  });

  it("keeps to the limit", () => {
    const signals = watchSignalsFrom([], ["a", "a", "b", "b"]);
    expect(rankWatchList(signals, 1)).toHaveLength(1);
  });
});
