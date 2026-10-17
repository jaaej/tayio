export function freeTrialTodayDedupeKey(
  lessonId: string,
  studentId: string,
): string {
  return `free-trial-today:${lessonId}:${studentId}`;
}

export function freeTrialFollowUpDedupeKey(
  studentId: string,
  endDate: string,
): string {
  return `free-trial-follow-up:${studentId}:${endDate}`;
}

/**
 * Trials ending on or after this day remove the student from the classes they
 * joined for the trial once it is over. Earlier trials are left alone: before
 * this, a trial that ended was only a follow-up reminder, so students who
 * stayed on may still have one on record.
 */
export const TRIAL_WITHDRAW_FROM_END_DATE = "2026-10-18";

/** Days before a trial's start that a class can be joined "for the trial". */
export const TRIAL_JOIN_LEAD_DAYS = 7;

function addIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * True when a class was joined for the trial: from a week before the trial
 * started to its last day (Melbourne dates). A class joined after the trial
 * ended (say, re-added because the student stayed on) is not.
 */
export function joinedForTrial(
  joinedOn: string,
  trial: { startDate: string; endDate: string },
): boolean {
  return joinedOn >= addIsoDays(trial.startDate, -TRIAL_JOIN_LEAD_DAYS) && joinedOn <= trial.endDate;
}

/** True when the trial is over and its classes should be left. */
export function trialWithdrawalDue(endDate: string, today: string): boolean {
  return endDate < today && endDate >= TRIAL_WITHDRAW_FROM_END_DATE;
}

export function freeTrialEndsTodayDedupeKey(studentId: string, endDate: string): string {
  return `free-trial-ends:${studentId}:${endDate}`;
}

export function freeTrialLeftClassDedupeKey(
  classId: string,
  studentId: string,
  endDate: string,
): string {
  return `free-trial-left:${classId}:${studentId}:${endDate}`;
}
