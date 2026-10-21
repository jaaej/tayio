/**
 * Rules for a lesson Taiyo cancels for everyone (src/lib/lesson-cancel.ts).
 */

/** At least this long to book a make-up with the credit. */
export const CANCEL_CREDIT_MIN_DAYS = 28;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * When the class credit for a cancelled lesson expires: the end of its term,
 * or four weeks after the lesson when that is later, so a lesson cancelled
 * in the term's last week still leaves time for a make-up.
 */
export function cancelCreditExpiry(termEnd: string, lessonDate: string): string {
  const floor = addDays(lessonDate, CANCEL_CREDIT_MIN_DAYS);
  return floor > termEnd ? floor : termEnd;
}

/** The lesson's term, or the next one after it (a lesson in the holidays). */
export function creditTermFor<T extends { startDate: string; endDate: string }>(
  terms: T[],
  lessonDate: string,
): T | null {
  const within = terms.find((t) => t.startDate <= lessonDate && lessonDate <= t.endDate);
  if (within) return within;
  return [...terms].filter((t) => t.startDate > lessonDate).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
}

const TAUGHT = new Set(["present", "late", "left_early"]);

/** Why the lesson can't be cancelled, or null. A lesson someone taught keeps its record. */
export function cancelRefusal(input: {
  status: string;
  marks: string[];
  notes: number;
}): string | null {
  if (input.status === "cancelled") return "This lesson is already cancelled.";
  if (input.status === "rescheduled") return "This lesson was moved, so it isn't running.";
  if (input.marks.some((m) => TAUGHT.has(m)) || input.notes > 0) {
    return "Someone taught this lesson: its roll has marks or a tutor's note. Clear them first, or delete the lesson.";
  }
  return null;
}
