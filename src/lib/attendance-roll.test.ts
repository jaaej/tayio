import { describe, expect, it } from "vitest";
import { canMarkAllPresent, markAllPresent, rollSummary } from "./attendance-roll";

const roll = [
  { id: "a" },
  { id: "b" },
  { id: "moved", movedOutTo: "Thu 4 pm" },
  { id: "makeup", makeupFrom: "Tue 6 Oct" },
];

describe("markAllPresent", () => {
  it("marks only the class that is here", () => {
    const next = markAllPresent(roll, {
      a: null,
      b: "late",
      moved: "absent",
      makeup: "makeup_attended",
    });
    expect(next).toEqual({
      a: "present",
      b: "present",
      moved: "absent",
      makeup: "makeup_attended",
    });
  });

  it("does not mutate the input", () => {
    const input = { a: null };
    markAllPresent([{ id: "a" }], input);
    expect(input).toEqual({ a: null });
  });
});

describe("canMarkAllPresent", () => {
  it("is false when everyone moved or is a make-up", () => {
    expect(canMarkAllPresent(roll.slice(2))).toBe(false);
    expect(canMarkAllPresent(roll)).toBe(true);
  });
});

describe("rollSummary", () => {
  it("counts in option order and ends with the unmarked", () => {
    expect(
      rollSummary(roll, { a: "late", b: "present", moved: null, makeup: "present" }),
    ).toBe("2 present · 1 late · 1 not marked");
  });

  it("is empty for an empty roll", () => {
    expect(rollSummary([], {})).toBe("");
  });
});
