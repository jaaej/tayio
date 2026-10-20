import { FINAL_YEAR, parseStudentYear, studentYearLabel } from "@/lib/year-level";

/**
 * End of the school year: archiving the Year 12s and moving every other
 * student up a year. The rules are here; `src/app/admin/_lib/school-year.ts`
 * runs them.
 */

export type TermDates = { year: number; termNumber: number; startDate: string; endDate: string };

/** A school year's last term is Term 4 or later; earlier, its terms are not all set yet. */
const MIN_FINAL_TERM = 4;

/**
 * The school year whose end the Terms page offers: the year of the latest
 * term that has started, once its final term (Term 4, or a later one) has
 * started. Null before then, so the actions never sit on the page mid-year.
 */
export function schoolYearToEnd(
  terms: TermDates[],
  today: string,
): { year: number; finalTerm: TermDates; termEnded: boolean } | null {
  const started = terms.filter((t) => t.startDate <= today);
  if (started.length === 0) return null;
  const year = Math.max(...started.map((t) => t.year));
  const finalTerm = terms
    .filter((t) => t.year === year)
    .sort((a, b) => b.termNumber - a.termNumber)[0];
  if (!finalTerm || finalTerm.termNumber < MIN_FINAL_TERM || finalTerm.startDate > today) return null;
  return { year, finalTerm, termEnded: finalTerm.endDate < today };
}

export type RolloverStudent = { id: string; name: string; yearLevel: string | null };

export type RolloverPlan = {
  /** Students moving up, with their old and new levels. */
  moves: { id: string; from: string; to: string }[];
  /** Year 12 students: they finish school and are archived. */
  finishing: RolloverStudent[];
  /** No year level, or one that is not a school year ("VCE"): left as they are. */
  unknown: RolloverStudent[];
};

/** What moving every student up a year would do. */
export function planRollover(students: RolloverStudent[]): RolloverPlan {
  const plan: RolloverPlan = { moves: [], finishing: [], unknown: [] };
  for (const s of students) {
    const year = parseStudentYear(s.yearLevel);
    if (year === null) plan.unknown.push(s);
    else if (year >= FINAL_YEAR) plan.finishing.push(s);
    else plan.moves.push({ id: s.id, from: studentYearLabel(year), to: studentYearLabel(year + 1) });
  }
  return plan;
}

/** "Year 7 → Year 8" rows with their counts, in school order, for the confirmation. */
export function moveSummary(moves: RolloverPlan["moves"]): { from: string; to: string; count: number }[] {
  const byFrom = new Map<string, { from: string; to: string; count: number }>();
  for (const m of moves) {
    const row = byFrom.get(m.from) ?? { from: m.from, to: m.to, count: 0 };
    row.count += 1;
    byFrom.set(m.from, row);
  }
  return [...byFrom.values()].sort((a, b) => (parseStudentYear(a.from) ?? 0) - (parseStudentYear(b.from) ?? 0));
}

/** Year 12 students among these: the ones "Archive Year 12 students" takes. */
export function finalYearStudents<S extends { yearLevel: string | null }>(students: S[]): S[] {
  return students.filter((s) => parseStudentYear(s.yearLevel) === FINAL_YEAR);
}
