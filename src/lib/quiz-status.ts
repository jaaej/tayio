/**
 * Shared quiz-status labels/tones for the admin and tutor quiz pages.
 * Tone values are plain strings (not a specific Pill's tone union) so each
 * call site can cast to whichever Pill component it renders with -
 * admin pages use `@/components/admin/ui`'s Pill, tutor pages use
 * `@/components/student/pill`'s Pill, and the two tone unions differ.
 */
export const QUIZ_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  requested: "Requested",
  pending_review: "Pending review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const QUIZ_STATUS_TONE: Record<string, string> = {
  draft: "default",
  requested: "info",
  pending_review: "warn",
  changes_requested: "bad",
  approved: "good",
};

export function formatQuizWeekLabel(input: {
  subjectName: string;
  year: number;
  termNumber: number;
  weekNumber: number;
}): string {
  return `${input.subjectName} - ${input.year} Term ${input.termNumber}, Week ${input.weekNumber}`;
}

/**
 * Kind-aware "subject + period" label used by the admin/tutor quiz list rows.
 * A term test has no week, so it renders as "Term N test" instead of
 * "Term N, Week M".
 */
export function quizSubjectPeriodLabel(row: {
  subjectName: string;
  kind: "weekly" | "term_test";
  termNumber: number;
  weekNumber: number | null;
}): string {
  return row.kind === "term_test"
    ? `${row.subjectName} - Term ${row.termNumber} test`
    : `${row.subjectName} - Term ${row.termNumber}, Week ${row.weekNumber}`;
}

/** Same as {@link quizSubjectPeriodLabel} but also includes the term year, for detail-page headers. */
export function quizSubjectPeriodLabelWithYear(row: {
  subjectName: string;
  kind: "weekly" | "term_test";
  termYear: number;
  termNumber: number;
  weekNumber: number | null;
}): string {
  return row.kind === "term_test"
    ? `${row.subjectName} - ${row.termYear} Term ${row.termNumber} test`
    : `${row.subjectName} - ${row.termYear} Term ${row.termNumber}, Week ${row.weekNumber}`;
}
