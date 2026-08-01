import { describe, it, expect } from "vitest";
import { isOnLeave, validateLeaveRange } from "./student-leave";

const periods = [
  { startDate: "2026-07-03", endDate: "2026-07-10" },
  { startDate: "2026-08-10", endDate: "2026-08-10" }, // single-day holiday
];

describe("isOnLeave", () => {
  it("is true on the inclusive boundaries", () => {
    expect(isOnLeave("2026-07-03", periods)).toBe(true);
    expect(isOnLeave("2026-07-10", periods)).toBe(true);
  });

  it("is true inside a range", () => {
    expect(isOnLeave("2026-07-06", periods)).toBe(true);
  });

  it("is false just outside a range", () => {
    expect(isOnLeave("2026-07-02", periods)).toBe(false);
    expect(isOnLeave("2026-07-11", periods)).toBe(false);
  });

  it("handles a single-day period", () => {
    expect(isOnLeave("2026-08-10", periods)).toBe(true);
    expect(isOnLeave("2026-08-09", periods)).toBe(false);
  });

  it("is false with no periods", () => {
    expect(isOnLeave("2026-07-06", [])).toBe(false);
  });
});

describe("validateLeaveRange", () => {
  it("accepts a valid range", () => {
    expect(validateLeaveRange("2026-07-03", "2026-07-10")).toBeNull();
  });

  it("accepts a single day (start === end)", () => {
    expect(validateLeaveRange("2026-08-10", "2026-08-10")).toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(validateLeaveRange("2026-07-10", "2026-07-03")).toMatch(/before/);
  });

  it("rejects a missing or malformed date", () => {
    expect(validateLeaveRange("", "2026-07-10")).toMatch(/required/);
    expect(validateLeaveRange("2026-7-3", "2026-07-10")).toMatch(/required/);
  });
});
