export type CurriculumAccessTerm = {
  id: string;
  year: number;
  termNumber: number;
  startDate: string;
  endDate: string;
};

/** Convert a Date to the school calendar date used by the portal. */
export function melbourneDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/**
 * The enrolment term is the term containing the enrolment date, or the next
 * configured term when a student joins during a holiday. A student joining
 * after every configured term does not gain access to already-finished terms.
 */
export function findCurriculumEntryTerm(
  terms: CurriculumAccessTerm[],
  enrolledDate: string,
): CurriculumAccessTerm | null {
  const ordered = [...terms].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  return (
    ordered.find(
      (term) =>
        term.startDate <= enrolledDate && enrolledDate <= term.endDate,
    ) ??
    ordered.find((term) => term.startDate >= enrolledDate) ??
    null
  );
}

/**
 * Terms before the student's entry term are hidden unless explicitly granted.
 * Future terms stay hidden until their first day, even though they are after
 * the entry term.
 */
export function filterAccessibleTerms(
  terms: CurriculumAccessTerm[],
  enrolledDate: string,
  grantedTermIds: ReadonlySet<string>,
  todayDate: string,
): CurriculumAccessTerm[] {
  const entry = findCurriculumEntryTerm(terms, enrolledDate);
  return terms.filter((term) => {
    if (term.startDate > todayDate) return false;
    if (grantedTermIds.has(term.id)) return true;
    return Boolean(entry && term.startDate >= entry.startDate);
  });
}

/** Week 1 releases on the term start date; each next week releases 7 days later. */
export function releasedCurriculumWeek(
  term: Pick<CurriculumAccessTerm, "startDate" | "endDate">,
  maxWeek: number,
  todayDate: string,
): number {
  if (maxWeek <= 0 || todayDate < term.startDate) return 0;
  if (todayDate > term.endDate) return maxWeek;

  const start = Date.parse(`${term.startDate}T00:00:00Z`);
  const today = Date.parse(`${todayDate}T00:00:00Z`);
  const elapsedDays = Math.floor((today - start) / 86_400_000);
  return Math.min(maxWeek, Math.floor(elapsedDays / 7) + 1);
}
