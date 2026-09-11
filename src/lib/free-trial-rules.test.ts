import { describe, expect, it } from "vitest";
import {
  freeTrialFollowUpDedupeKey,
  freeTrialTodayDedupeKey,
} from "./free-trial-rules";

describe("free-trial notification keys", () => {
  it("deduplicates today's alert per student and lesson", () => {
    expect(freeTrialTodayDedupeKey("lesson-a", "student-a")).toBe(
      "free-trial-today:lesson-a:student-a",
    );
    expect(freeTrialTodayDedupeKey("lesson-b", "student-a")).not.toBe(
      freeTrialTodayDedupeKey("lesson-a", "student-a"),
    );
  });

  it("allows a new follow-up if a later trial period is configured", () => {
    expect(freeTrialFollowUpDedupeKey("student-a", "2026-09-01")).not.toBe(
      freeTrialFollowUpDedupeKey("student-a", "2026-10-01"),
    );
  });
});
