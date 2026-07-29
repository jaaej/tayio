import { describe, it, expect } from "vitest";
import { deriveTrialStatus, isEndingSoon } from "./trials";

describe("deriveTrialStatus", () => {
  it("is none when there is no end date", () => {
    expect(deriveTrialStatus(null, null, "2026-07-29")).toBe("none");
    expect(deriveTrialStatus("2026-07-01", null, "2026-07-29")).toBe("none");
  });
  it("is on_trial before the end date", () => {
    expect(deriveTrialStatus("2026-07-01", "2026-07-31", "2026-07-15")).toBe("on_trial");
  });
  it("is on_trial on the end date (inclusive)", () => {
    expect(deriveTrialStatus("2026-07-01", "2026-07-31", "2026-07-31")).toBe("on_trial");
  });
  it("is trial_ended the day after the end date", () => {
    expect(deriveTrialStatus("2026-07-01", "2026-07-31", "2026-08-01")).toBe("trial_ended");
  });
});

describe("isEndingSoon", () => {
  it("is false when not a trial", () => {
    expect(isEndingSoon(null, "2026-07-29")).toBe(false);
  });
  it("is true when active and ending within the window", () => {
    expect(isEndingSoon("2026-08-02", "2026-07-29")).toBe(true); // 4 days
  });
  it("is true exactly at the window boundary", () => {
    expect(isEndingSoon("2026-08-05", "2026-07-29", 7)).toBe(true); // 7 days
  });
  it("is false when ending beyond the window", () => {
    expect(isEndingSoon("2026-08-20", "2026-07-29", 7)).toBe(false);
  });
  it("is false when already ended", () => {
    expect(isEndingSoon("2026-07-20", "2026-07-29")).toBe(false);
  });
});
