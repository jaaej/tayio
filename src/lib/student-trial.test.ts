import { describe, expect, it } from "vitest";
import { isOnTrial, validateTrialRange } from "./student-trial";

describe("isOnTrial", () => {
  const trial = { startDate: "2026-08-01", endDate: "2026-08-14" };

  it("is false when there is no trial", () => {
    expect(isOnTrial("2026-08-05", null)).toBe(false);
    expect(isOnTrial("2026-08-05", undefined)).toBe(false);
  });

  it("includes both inclusive bounds", () => {
    expect(isOnTrial("2026-08-01", trial)).toBe(true);
    expect(isOnTrial("2026-08-14", trial)).toBe(true);
    expect(isOnTrial("2026-08-07", trial)).toBe(true);
  });

  it("excludes dates outside the range", () => {
    expect(isOnTrial("2026-07-31", trial)).toBe(false);
    expect(isOnTrial("2026-08-15", trial)).toBe(false);
  });
});

describe("validateTrialRange", () => {
  it("accepts a valid range", () => {
    expect(validateTrialRange("2026-08-01", "2026-08-14")).toBeNull();
    expect(validateTrialRange("2026-08-01", "2026-08-01")).toBeNull();
  });

  it("rejects malformed dates", () => {
    expect(validateTrialRange("", "2026-08-14")).not.toBeNull();
    expect(validateTrialRange("2026-8-1", "2026-08-14")).not.toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(validateTrialRange("2026-08-14", "2026-08-01")).not.toBeNull();
  });
});
