import { describe, expect, it } from "vitest";
import {
  freeTrialFollowUpDedupeKey,
  freeTrialTodayDedupeKey,
  joinedForTrial,
  trialWithdrawalDue,
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

describe("leaving classes when a trial ends", () => {
  const trial = { startDate: "2026-10-20", endDate: "2026-11-02" };

  it("counts classes joined from a week before the start to the last day", () => {
    expect(joinedForTrial("2026-10-13", trial)).toBe(true);
    expect(joinedForTrial("2026-10-20", trial)).toBe(true);
    expect(joinedForTrial("2026-11-02", trial)).toBe(true);
  });

  it("keeps a class the student already had, or was re-added to after the trial", () => {
    expect(joinedForTrial("2026-10-12", trial)).toBe(false);
    expect(joinedForTrial("2026-11-03", trial)).toBe(false);
  });

  it("is due the day after the last day, for trials ending from the rollout on", () => {
    expect(trialWithdrawalDue("2026-11-02", "2026-11-02")).toBe(false);
    expect(trialWithdrawalDue("2026-11-02", "2026-11-03")).toBe(true);
    // Ended before automatic removal existed: left alone.
    expect(trialWithdrawalDue("2026-10-17", "2026-11-03")).toBe(false);
    expect(trialWithdrawalDue("2026-10-18", "2026-10-19")).toBe(true);
  });
});
