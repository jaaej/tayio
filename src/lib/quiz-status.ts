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
  admin: "Admin",
};

export const QUIZ_STATUS_TONE: Record<string, string> = {
  draft: "default",
  requested: "info",
  pending_review: "warn",
  changes_requested: "bad",
  approved: "good",
  // Brand, not good: "admin" is live like "approved" but reached without a
  // review, and "info" is already spoken for by "requested". Both Pill tone
  // unions (admin + student) carry "brand".
  admin: "brand",
};

/**
 * The statuses a quiz is live in - visible to students, and to tutors who
 * teach the subject. `approved` is the reviewed tutor path; `admin` is a quiz
 * an admin wrote and published themselves. Anything gating student or tutor
 * visibility must accept both.
 */
export const LIVE_QUIZ_STATUSES = ["approved", "admin"] as const;

export function isLiveQuizStatus(status: string): boolean {
  return (LIVE_QUIZ_STATUSES as readonly string[]).includes(status);
}

export function formatQuizWeekLabel(input: {
  subjectName: string;
  year: number;
  termNumber: number;
  weekNumber: number;
}): string {
  return `${input.subjectName} - ${input.year} Term ${input.termNumber}, Week ${input.weekNumber}`;
}
