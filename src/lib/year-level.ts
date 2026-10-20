/**
 * A student's school year. Stored as the label in `STUDENT_YEAR_LEVELS`
 * ("Prep", "Year 1" to "Year 12"); older accounts may hold free text such as
 * "10", "Year10" or "VCE", which `parseStudentYear` reads where it can.
 */

export const FINAL_YEAR = 12;

/** Prep (Victoria's first school year, also called Foundation) is year 0. */
export const STUDENT_YEAR_LEVELS = [
  "Prep",
  ...Array.from({ length: FINAL_YEAR }, (_, i) => `Year ${i + 1}`),
] as const;

export type StudentYearLevel = (typeof STUDENT_YEAR_LEVELS)[number];

/** "Prep" for 0, "Year 7" for 7. */
export function studentYearLabel(year: number): StudentYearLevel {
  return STUDENT_YEAR_LEVELS[year];
}

/**
 * The school year a saved value means: 0 for Prep or Foundation, 1 to 12 for
 * "10", "Year 10", "Yr10", "Y10", "grade 10" and the like; null for anything
 * else ("VCE" spans two years, so it is not guessed).
 */
export function parseStudentYear(raw: string | null | undefined): number | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return null;
  if (/^(prep|foundation|f)$/i.test(value)) return 0;
  const numeric = /^(?:(?:year|yr|y|grade|gr)\.?\s*)?(\d{1,2})$/i.exec(value);
  if (!numeric) return null;
  const year = Number(numeric[1]);
  return year >= 1 && year <= FINAL_YEAR ? year : null;
}

/** The stored label for a saved value, or null when it is not a school year. */
export function canonicalStudentYear(raw: string | null | undefined): StudentYearLevel | null {
  const year = parseStudentYear(raw);
  return year === null ? null : studentYearLabel(year);
}

/** The Year level choices, keeping a saved value that is not in the list. */
export function studentYearOptions(current: string | null | undefined): string[] {
  const saved = current?.trim();
  return saved && !canonicalStudentYear(saved) ? [...STUDENT_YEAR_LEVELS, saved] : [...STUDENT_YEAR_LEVELS];
}
