import { describe, expect, it } from "vitest";
import { canMarkAllPresent, markAllPresent, rollStatusOf, rollSummary } from "./attendance-roll";

const roll = [
  { id: "a" },
  { id: "b" },
  { id: "moved", movedOutTo: "Thu 4 pm" },
  { id: "credit", tookCredit: true },
  { id: "makeup", makeupFrom: "Tue 6 Oct" },
];

describe("markAllPresent", () => {
  it("marks everyone here, make-ups included, and leaves those away", () => {
    const next = markAllPresent(roll, {
      a: null,
      b: "late",
      moved: "absent",
      credit: "absent",
      makeup: null,
    });
    expect(next).toEqual({
      a: "present",
      b: "present",
      moved: "absent",
      credit: "absent",
      makeup: "present",
    });
  });

  it("does not mutate the input", () => {
    const input = { a: null };
    markAllPresent([{ id: "a" }], input);
    expect(input).toEqual({ a: null });
  });
});

describe("canMarkAllPresent", () => {
  it("is false when everyone moved or took a credit", () => {
    expect(canMarkAllPresent(roll.slice(2, 4))).toBe(false);
    expect(canMarkAllPresent(roll.slice(4))).toBe(true);
  });
});

describe("rollStatusOf", () => {
  it("shows a saved mark, an old make-up mark as Present, and nothing else", () => {
    expect(rollStatusOf("late")).toBe("late");
    expect(rollStatusOf("makeup_attended")).toBe("present");
    expect(rollStatusOf(null)).toBeNull();
    expect(rollStatusOf("excused")).toBeNull();
  });
});

describe("rollSummary", () => {
  it("counts in option order and ends with the unmarked", () => {
    expect(
      rollSummary(roll, { a: "late", b: "present", moved: null, credit: "absent", makeup: null }),
    ).toBe("1 present · 1 late · 1 absent · 2 not marked");
  });

  it("is empty for an empty roll", () => {
    expect(rollSummary([], {})).toBe("");
  });
});
