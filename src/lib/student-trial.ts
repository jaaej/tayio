/**
 * Pure helpers for a per-student free-trial period. Dates are ISO date strings
 * (`YYYY-MM-DD`), which compare correctly as plain strings - no Date parsing or
 * timezone hazard.
 */

export type TrialPeriod = {
  startDate: string;
  endDate: string;
};

/** True if `dateISO` falls within the trial's inclusive [start, end] range. */
export function isOnTrial(
  dateISO: string,
  trial: TrialPeriod | null | undefined,
): boolean {
  if (!trial) return false;
  return trial.startDate <= dateISO && dateISO <= trial.endDate;
}

/**
 * Validate a proposed trial range. Returns an error string, or null if valid.
 * Both bounds are required ISO dates and the end must not precede the start.
 */
export function validateTrialRange(
  startDate: string,
  endDate: string,
): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(startDate) || !iso.test(endDate)) {
    return "Both a start and end date are required.";
  }
  if (endDate < startDate) {
    return "The end date can't be before the start date.";
  }
  return null;
}
