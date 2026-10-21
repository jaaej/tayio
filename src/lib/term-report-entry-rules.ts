/**
 * The tutor's part of a term report (migration 0081): a summary of the term
 * per student and subject, and three ratings from 1 to 5.
 */

export const REPORT_RATINGS = [
  { key: "effort", label: "Effort" },
  { key: "homework", label: "Homework" },
  { key: "understanding", label: "Understanding" },
] as const;

export type RatingKey = (typeof REPORT_RATINGS)[number]["key"];
export type Ratings = Record<RatingKey, number>;

/** What each point on the scale means, 1 to 5. */
export const RATING_SCALE = ["Needs support", "Developing", "Steady", "Strong", "Excellent"] as const;

export function ratingLabel(value: number): string {
  return RATING_SCALE[value - 1] ?? "";
}

export const SUMMARY_MAX = 4000;

/** Tutors write reports from three weeks before a term ends to four weeks after. */
export const REPORTS_OPEN_DAYS_BEFORE_END = 21;
export const REPORTS_CLOSE_DAYS_AFTER_END = 28;

type TermDates = { id: string; startDate: string; endDate: string };

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The term tutors are writing reports for today, or null outside every
 * term's window (so the tutor's Term reports menu item and To do stay
 * hidden mid-term). When two windows meet, the later term wins.
 */
export function reportWritingTerm<T extends TermDates>(terms: T[], today: string): T | null {
  return (
    terms
      .filter(
        (t) =>
          shift(t.endDate, -REPORTS_OPEN_DAYS_BEFORE_END) <= today &&
          today <= shift(t.endDate, REPORTS_CLOSE_DAYS_AFTER_END),
      )
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null
  );
}

/** A summary and ratings ready to save, or the reason they are not. */
export function checkEntry(input: { summary: string } & Ratings): string | null {
  const summary = input.summary.trim();
  if (!summary) return "Write a summary of the term.";
  if (summary.length > SUMMARY_MAX) return `Keep the summary under ${SUMMARY_MAX} characters.`;
  for (const r of REPORT_RATINGS) {
    const v = input[r.key];
    if (!Number.isInteger(v) || v < 1 || v > 5) return `Rate ${r.label.toLowerCase()} from 1 to 5.`;
  }
  return null;
}
