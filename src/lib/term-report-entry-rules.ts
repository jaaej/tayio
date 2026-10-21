/**
 * The tutor's part of a term report (migration 0081): strengths, what to work
 * on and goals, per student and subject. The report's ratings are the
 * system's (`attainment-bands`), not the tutor's.
 */

/** What the tutor writes for each student and subject, in report order. */
export const REPORT_FIELDS = [
  {
    key: "strengths",
    label: "Strengths",
    hint: "What they did well this term.",
  },
  {
    key: "toWorkOn",
    label: "To work on",
    hint: "What would help them most next.",
  },
  {
    key: "goals",
    label: "Goals for next term",
    hint: "Two or three goals to aim for.",
  },
] as const;

export type FieldKey = (typeof REPORT_FIELDS)[number]["key"];
export type EntryText = Record<FieldKey, string>;

export const FIELD_MAX = 1500;

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

/** The three parts ready to save, or what is missing. */
export function checkEntry(input: EntryText): string | null {
  for (const f of REPORT_FIELDS) {
    const text = input[f.key].trim();
    if (!text) return `Write the ${f.label.toLowerCase()} part.`;
    if (text.length > FIELD_MAX) return `Keep ${f.label.toLowerCase()} under ${FIELD_MAX} characters.`;
  }
  return null;
}
