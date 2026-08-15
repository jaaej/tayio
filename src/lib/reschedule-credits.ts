/**
 * Pure limit + credit logic for the self-serve reschedule/cancellation feature.
 * No database or server-only imports so it is fully unit-testable. See
 * docs/superpowers/specs/2026-07-29-reschedule-credits-design.md.
 */

export const CANCEL_NOTICE_HOURS = 24;
export const RESCHEDULE_NOTICE_DAYS = 7;
export const CANCEL_CAP = 3;
export const RESCHEDULE_CAP = 3;

export type TermRow = { id: string; startDate: string; endDate: string };
export type CreditStatus = "active" | "redeemed" | "expired";

/** The term whose inclusive [startDate, endDate] range contains `dateIso`
 *  (YYYY-MM-DD), or null if the date falls in no defined term. */
export function resolveTerm(dateIso: string, terms: TermRow[]): TermRow | null {
  return terms.find((t) => t.startDate <= dateIso && dateIso <= t.endDate) ?? null;
}

/** Milliseconds from `now` to the local lesson start (date + HH:MM:SS). */
function msUntilLessonStart(now: Date, date: string, startTime: string): number {
  return new Date(`${date}T${startTime}`).getTime() - now.getTime();
}

/** At least 24h before the lesson start. */
export function meetsCancelNotice(now: Date, date: string, startTime: string): boolean {
  return msUntilLessonStart(now, date, startTime) >= CANCEL_NOTICE_HOURS * 3_600_000;
}

/** At least 7 days before the lesson start. */
export function meetsRescheduleNotice(now: Date, date: string, startTime: string): boolean {
  return msUntilLessonStart(now, date, startTime) >= RESCHEDULE_NOTICE_DAYS * 24 * 3_600_000;
}

/** Remaining allowance, never negative. */
export function remaining(cap: number, used: number): number {
  return Math.max(0, cap - used);
}

/** Effective status, deriving expiry lazily. A credit is still active on its
 *  expiry day (today === expiresAt); redeemed is terminal. */
export function deriveCreditStatus(
  stored: CreditStatus,
  expiresAt: string,
  todayIso: string,
): CreditStatus {
  if (stored === "redeemed") return "redeemed";
  if (todayIso > expiresAt) return "expired";
  return "active";
}
