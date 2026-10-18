import { describe, expect, it } from "vitest";
import { classCapacity, oneOnOneError } from "./class-capacity";

describe("classCapacity", () => {
  it("fixes a one-on-one class at one place", () => {
    expect(classCapacity("one_on_one", 8)).toBe(1);
  });

  it("keeps a group class's own capacity", () => {
    expect(classCapacity("group", 6)).toBe(6);
  });
});

describe("oneOnOneError", () => {
  it("refuses a second student in a one-on-one class", () => {
    expect(oneOnOneError("one_on_one", 2)).toMatch(/one student/);
  });

  it("allows one or none, and any number in a group", () => {
    expect(oneOnOneError("one_on_one", 1)).toBeNull();
    expect(oneOnOneError("one_on_one", 0)).toBeNull();
    expect(oneOnOneError("group", 12)).toBeNull();
  });
});
