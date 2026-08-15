/**
 * Pure helpers for per-student leave / holiday periods. Dates are ISO date
 * strings (`YYYY-MM-DD`), which compare correctly with plain string
 * comparison, so no Date parsing (or timezone hazard) is involved.
 */

export type LeavePeriod = {
  startDate: string;
  endDate: string;
};

/** True if `dateISO` falls within any period's inclusive [start, end] range. */
export function isOnLeave(dateISO: string, periods: LeavePeriod[]): boolean {
  return periods.some(
    (p) => p.startDate <= dateISO && dateISO <= p.endDate,
  );
}

/**
 * Validate a proposed leave range. Returns an error string, or null if valid.
 * Both bounds are required ISO dates and the end must not precede the start.
 */
export function validateLeaveRange(
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
