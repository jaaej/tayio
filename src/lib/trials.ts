export type TrialStatus = "none" | "on_trial" | "trial_ended";

/**
 * Derives a trial's status from its dates (YYYY-MM-DD strings compared
 * lexicographically, which is date-only and timezone-safe). An enrollment is a
 * trial only when it has an end date; the start date is informational and does
 * not affect the on_trial/ended split. Pure.
 */
export function deriveTrialStatus(
  trialStartsAt: string | null,
  trialEndsAt: string | null,
  today: string,
): TrialStatus {
  if (trialEndsAt === null) return "none";
  return today <= trialEndsAt ? "on_trial" : "trial_ended";
}

/** True when the trial is active and ends within `withinDays` (default 7). Pure. */
export function isEndingSoon(
  trialEndsAt: string | null,
  today: string,
  withinDays = 7,
): boolean {
  if (trialEndsAt === null) return false;
  if (today > trialEndsAt) return false;
  const end = Date.parse(`${trialEndsAt}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  const days = Math.round((end - now) / 86_400_000);
  return days <= withinDays;
}
